---
title: ECS Fargate, load balancing, DNS, and logs
tech: AWS ECS Fargate, Application Load Balancer, Route 53, ACM, CloudWatch
version: Amazon ECS on Fargate (Graviton, Fargate Spot), Application Load Balancer, Route 53, ACM, CloudWatch Logs and Container Insights
date: 2026-11-07
covers: [4, 9, 12]
---
# ECS Fargate, load balancing, DNS, and logs
[← Overview](00-overview.md)

## Why it matters
- Tasks get public IPs "to reach Stripe". Each one is directly reachable from the internet, bypassing the load balancer and its TLS.
- The TLS certificate was uploaded by hand two years ago. It expires on a Saturday, and every client fails.
- CloudWatch log groups were created without retention. Three years of debug logs cost more each month than the tasks producing them.

## Concepts

### ECS building blocks
| Piece | Role |
|:--|:--|
| Cluster | a namespace for services and tasks (Fargate needs no servers) |
| Task definition | a versioned recipe: image, CPU/memory, env, secrets, logs, roles, health check |
| Task | one running copy of a task definition |
| Service | keeps N tasks running, replaces failed ones, rolls out new revisions, registers with the ALB |
| Capacity providers | `FARGATE` and `FARGATE_SPOT` (interruptible, much cheaper; fine for workers) |
| `awsvpc` network mode | every task gets its own ENI and security group |
| ECS Exec | shell into a running task through SSM, audited |

Fargate sizes (vCPU → memory): 0.25 → 0.5–2 GB · 0.5 → 1–4 GB · 1 → 2–8 GB · 2 → 4–16 GB · 4 → 8–30 GB · 8 → 16–60 GB · 16 → 32–120 GB.

### Services in this stack
| Service | Behind ALB | Notes |
|:--|:--|:--|
| `web` (Next.js) | yes, default rule | static assets from CloudFront |
| `api` (Express) | yes, host `api.shop.com` | autoscaled on CPU or requests |
| `worker` (BullMQ) | no | Fargate Spot is fine: jobs are retried after interruptions |
| `migrate` | no | one-off task per deploy ([04-deployments](../../04-deployments/README.md)) |

### Application Load Balancer
| Setting | Value |
|:--|:--|
| Listener 80 | redirect to 443 |
| Listener 443 | ACM certificate, TLS 1.2+/1.3 policy (`ELBSecurityPolicy-TLS13-1-2-2021-06`) |
| Rules | host-based: `api.shop.com` → api target group; default → web |
| Target groups | type `ip` (Fargate), health check `/health/ready`, deregistration delay 30–60 s |
| Idle timeout | 60 s (Node `keepAliveTimeout` 65 s) |
| Access logs | to S3, for investigations |
| AWS WAF | managed rule groups and rate rules in front (also seen) |

### DNS and TLS
| Piece | Use |
|:--|:--|
| Route 53 hosted zone | DNS for `shop.com` |
| Alias records | `shop.com`, `api.shop.com` → ALB; `static.shop.com` → CloudFront (no extra charge for alias queries to AWS resources) |
| ACM certificates | free, DNS-validated, renewed automatically |
| CloudFront certificates | must be in `us-east-1` |
| CAA record | restricts which CAs may issue for your domain |

### Logs and platform metrics
| Item | Use |
|:--|:--|
| `awslogs` driver | container stdout/stderr → CloudWatch Logs |
| Log group retention | always set (e.g. 30 days); the default is "never expire" |
| Container Insights | per-service CPU, memory, network, restarts |
| CloudWatch alarms | platform signals: ALB 5xx, unhealthy hosts, RDS storage, ElastiCache memory |
| Grafana CloudWatch data source | the same dashboards as app telemetry ([03-backend/10-observability](../../../03-backend/10-observability/README.md)) |

## Example
`taskdef/api.json` — the production API task definition (CI fills in the image digest).
```json
{
  "family": "shop-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "runtimePlatform": { "cpuArchitecture": "ARM64", "operatingSystemFamily": "LINUX" },
  "executionRoleArn": "arn:aws:iam::123456789012:role/shop-api-execution",
  "taskRoleArn": "arn:aws:iam::123456789012:role/shop-api-task",
  "volumes": [{ "name": "tmp" }],
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789012.dkr.ecr.eu-central-1.amazonaws.com/shop-api@sha256:<digest>",
      "essential": true,
      "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
      "environment": [
        { "name": "APP_ENV", "value": "production" },
        { "name": "NODE_OPTIONS", "value": "--max-old-space-size=1536" },
        { "name": "OTEL_EXPORTER_OTLP_ENDPOINT", "value": "http://localhost:4318" }
      ],
      "secrets": [
        { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:eu-central-1:123456789012:secret:prod/shop/database-url-AbCdEf" },
        { "name": "STRIPE_SECRET_KEY", "valueFrom": "arn:aws:secretsmanager:eu-central-1:123456789012:secret:prod/shop/stripe-AbCdEf:secret_key::" }
      ],
      "readonlyRootFilesystem": true,
      "mountPoints": [{ "sourceVolume": "tmp", "containerPath": "/tmp" }],
      "linuxParameters": { "initProcessEnabled": true },
      "stopTimeout": 30,
      "healthCheck": {
        "command": ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/health/live').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))\""],
        "interval": 15, "timeout": 5, "retries": 3, "startPeriod": 30
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/shop-api",
          "awslogs-region": "eu-central-1",
          "awslogs-stream-prefix": "api",
          "mode": "non-blocking",
          "max-buffer-size": "25m"
        }
      }
    }
  ]
}
```
The Alloy sidecar from [03-backend/10-observability lesson 03](../../../03-backend/10-observability/docs/03-lgtm-dashboards-alerting.md) is a second container in the same task, listening on `localhost:4318`.

Service settings (Terraform `aws_ecs_service`, abbreviated):
```hcl
resource "aws_ecs_service" "api" {
  name                              = "api"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.api.arn
  desired_count                     = 3
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 60
  enable_execute_command            = true

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false                     # outbound via NAT, inbound only via the ALB
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  lifecycle { ignore_changes = [task_definition, desired_count] }   # CI deploys, autoscaling scales
}
```
TLS, DNS, and log retention:
```hcl
resource "aws_acm_certificate" "main" {
  domain_name               = "shop.com"
  subject_alternative_names = ["*.shop.com"]
  validation_method         = "DNS"
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.shop.com"
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/shop-api"
  retention_in_days = 30                         # the default keeps logs forever
}
```
Getting into a running task (instead of SSH):
```bash
aws ecs execute-command --cluster shop-prod --task <task-id> --container api --interactive --command "sh"
```

## Production patterns
- **Tasks in private subnets without public IPs**, reachable only through the ALB; outbound through NAT or VPC endpoints.
- **Task definitions as versioned JSON** deployed by CI; Terraform owns the service and ignores the revision and count.
- **Graviton for services, Fargate Spot for workers**, deployment circuit breaker with rollback everywhere.
- **ACM and Route 53 aliases** for zero-maintenance TLS and DNS.
- **Log retention on every group**, Container Insights for platform metrics, alarms routed to the same on-call as app alerts.

## Mistakes
Wrong: `assign_public_ip = true` to get outbound internet. Every task is exposed. Right: private subnets with NAT or VPC endpoints.

Wrong: secrets in `environment`.
```json
{ "name": "STRIPE_SECRET_KEY", "value": "sk_live_…" }
```
Visible to anyone who can read the task definition. Right: `secrets` with `valueFrom` pointing to Secrets Manager.

Wrong: Terraform and CI both managing the task definition revision. Every `terraform apply` rolls production back to an old image. Right: `ignore_changes = [task_definition]`, CI owns revisions.

Wrong: log groups with no retention, debug logs in production. Right: retention per group, `info` level, application telemetry in Loki.

## Check yourself
1. Why do Fargate tasks in private subnets still reach Stripe, and why is that safer than public IPs?
2. What belongs in a task definition, and who should update it?
3. Why must CloudFront certificates live in `us-east-1`?

<details>
<summary>Answers</summary>

1. Outbound traffic goes through a NAT gateway in a public subnet, so tasks can open connections out, but nothing on the internet can open a connection to them. Public IPs would make each task directly reachable and bypass the ALB.
2. The runtime recipe: image (by digest), CPU/memory, architecture, environment, secrets references, log config, health check, roles, stop timeout. The deployment pipeline registers a new revision per release; Terraform creates the service and ignores revision changes.
3. CloudFront is a global service whose configuration lives in `us-east-1`, so it can only use ACM certificates from that region. Regional services like the ALB use certificates from their own region.
</details>

## Sources
- [Amazon ECS — Task definition parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)
- [Amazon ECS — Fargate task CPU and memory](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html)
- [Elastic Load Balancing — Application Load Balancers](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html)
- [AWS Certificate Manager — DNS validation](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html)
- [Amazon ECS — Pass secrets to containers](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html)
- [CloudWatch Container Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html)
