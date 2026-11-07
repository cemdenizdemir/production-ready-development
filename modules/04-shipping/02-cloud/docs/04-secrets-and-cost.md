---
title: Secrets, configuration, and cost
tech: AWS Secrets Manager, AWS Systems Manager Parameter Store, AWS Budgets
version: AWS Secrets Manager, SSM Parameter Store, AWS KMS, AWS Budgets, Cost Explorer, Cost Anomaly Detection, Savings Plans
date: 2026-11-07
covers: [8, 11]
---
# Secrets, configuration, and cost
[← Overview](00-overview.md)

## Why it matters
- The Stripe key is rotated after a leak, but tasks keep using the old one for days, because nobody knew ECS only reads secrets when a task starts.
- A forgotten load test environment with three NAT gateways and a Multi-AZ database runs for four months: about $1,500 for nothing.
- The first bill after launch is twice the estimate. Most of it is NAT data processing and CloudWatch log ingestion, neither of which anyone thought about.

## Concepts

### Secrets and configuration on AWS
| Store | Use | Notes |
|:--|:--|:--|
| Secrets Manager | passwords, API keys, connection strings | rotation (built in for RDS), per-secret price, resource policies |
| SSM Parameter Store | non-secret config, cheap secrets (`SecureString`) | standard parameters free, KMS-encrypted SecureStrings |
| Task definition `environment` | non-secret values | visible to anyone who can read the task definition |
| Task definition `secrets` | inject from Secrets Manager/SSM at task start | changes need a new deployment or task restart |
| KMS | encryption keys for both | customer-managed keys when you need key policies and audit |

| Practice | Why |
|:--|:--|
| One secret per purpose and environment (`prod/shop/stripe`) | least privilege, clean rotation |
| Execution role can read only its service's secrets | a compromised task sees little |
| Rotate on a schedule and on suspicion | RDS-managed rotation; manual for third-party keys |
| Redeploy after rotation | running tasks keep the old value until restarted |
| Prefer roles over secrets | S3, SES, SQS need no keys: the task role covers them |
| Never in images, repos, logs, or Terraform state | write-only arguments and RDS-managed passwords keep them out of state ([03-iac](../../03-iac/README.md)) |

### What costs money
| Item | Pricing shape (us-east-1 list prices; other regions differ) | Levers |
|:--|:--|:--|
| Fargate | per vCPU-hour and GB-hour | right-size, Graviton (up to ~20% cheaper), Spot for workers (up to ~70% off), Compute Savings Plans |
| NAT gateway | ~$0.045/hour each + ~$0.045/GB processed | VPC endpoints (S3 gateway endpoint is free), one NAT in dev |
| ALB | ~$0.0225/hour + capacity units | share one ALB with host rules |
| RDS | instance hours (Multi-AZ doubles) + storage + backups beyond DB size | right-size, Graviton, reserved instances |
| ElastiCache | node hours | right-size, Graviton, reserved nodes |
| Data transfer | internet egress; cross-AZ ~$0.01/GB each way | CloudFront for egress, keep chatty traffic in one AZ where safe |
| Public IPv4 | ~$0.005/hour per address | private subnets, no public IPs on tasks |
| CloudWatch Logs | ~$0.50/GB ingested + storage | `info` level, retention, app logs in Loki |
| Secrets Manager | ~$0.40/secret/month + API calls | group related values in one JSON secret |

### Cost control
| Practice | How |
|:--|:--|
| Budgets | AWS Budgets per account with alerts at 50/80/100% of forecast |
| Anomaly detection | Cost Anomaly Detection alerts on unusual spend by service |
| Cost allocation tags | `Environment`, `Service`, `Team` on everything (Terraform `default_tags`) |
| Review | monthly Cost Explorer review by service and tag |
| Non-production off-hours | scale dev/staging services to 0 at night and weekends |
| Commitments | Savings Plans and reservations only for stable baseline usage |
| Architecture reviews | estimate with the AWS Pricing Calculator before building |

## Example
Creating and reading secrets:
```bash
# A JSON secret with several values for one integration
aws secretsmanager create-secret --name prod/shop/stripe \
  --secret-string '{"secret_key":"rk_live_…","webhook_secret":"whsec_…"}'

# Rotate a third-party key: put the new value, then redeploy so tasks pick it up
aws secretsmanager put-secret-value --secret-id prod/shop/stripe --secret-string file://stripe.json
aws ecs update-service --cluster shop-prod --service api --force-new-deployment

# Non-secret configuration in Parameter Store
aws ssm put-parameter --name /prod/shop/feature-flags --type String --value '{"newCheckout":false}'
```
Execution role policy — only this service's secrets.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": [
        "arn:aws:secretsmanager:eu-central-1:123456789012:secret:prod/shop/database-url-*",
        "arn:aws:secretsmanager:eu-central-1:123456789012:secret:prod/shop/stripe-*"
      ]
    }
  ]
}
```
`infra/envs/prod/budget.tf` — a budget with forecast alerts and tags on every resource.
```hcl
provider "aws" {
  region = "eu-central-1"
  default_tags {
    tags = { Environment = "prod", Service = "shop", Team = "platform", ManagedBy = "terraform" }
  }
}

resource "aws_budgets_budget" "monthly" {
  name         = "shop-prod-monthly"
  budget_type  = "COST"
  limit_amount = "1500"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["platform-alerts@shop.com"]
  }
}
```
Scaling staging to zero outside working hours:
```hcl
resource "aws_appautoscaling_scheduled_action" "staging_night" {
  name               = "staging-api-night"
  service_namespace  = "ecs"
  resource_id        = "service/shop-staging/api"
  scalable_dimension = "ecs:service:DesiredCount"
  schedule           = "cron(0 20 ? * MON-FRI *)"              # 20:00 UTC
  scalable_target_action {
    min_capacity = 0
    max_capacity = 0
  }
}
```

## Production patterns
- **Secrets Manager for secrets, Parameter Store for config**, injected through `secrets`, never in images or plain env.
- **Rotation followed by a redeploy**, and roles instead of secrets wherever AWS supports it.
- **Budgets with forecast alerts and anomaly detection** in every account from day one.
- **Tags on everything** via provider `default_tags`, so cost is visible per service and environment.
- **Cheap non-production**: single NAT, smaller instances, scaled to zero at night.

## Mistakes
Wrong: rotating a secret and assuming running tasks see it. They read secrets once, at start. Right: force a new deployment after rotation (or have the app re-fetch where it matters).

Wrong: one shared secret readable by every service. Right: per-service secrets and execution-role policies scoped to them.

Wrong: no budget alerts until the first surprising bill. Right: budgets and anomaly detection before the first deploy.

Wrong: development environments sized and replicated like production, running 24/7. Right: smaller, single-AZ where acceptable, off outside working hours.

## Check yourself
1. When does an ECS task read the values in its `secrets`, and what follows from that?
2. Name three costs that often surprise teams on AWS, and a lever for each.
3. Why prefer task roles over API keys for AWS services?

<details>
<summary>Answers</summary>

1. When the task starts: the agent fetches the values and injects them as environment variables. A rotated secret therefore reaches running tasks only after they're replaced, so rotation must be followed by a new deployment.
2. NAT gateway data processing (VPC endpoints, especially the free S3 gateway endpoint), CloudWatch Logs ingestion (lower log level, retention, app logs elsewhere), cross-AZ and egress data transfer (CloudFront, careful placement), idle non-production environments (scale to zero, smaller sizes), public IPv4 addresses (private subnets).
3. Roles give short-lived credentials that rotate automatically and can't be copied out of a repo or log. API keys are long-lived secrets that must be stored, rotated, and protected, and they leak.
</details>

## Sources
- [AWS Secrets Manager — Best practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [Amazon ECS — Pass secrets to containers](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html)
- [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
- [AWS Cost Anomaly Detection](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html)
- [AWS Pricing Calculator](https://calculator.aws/)
