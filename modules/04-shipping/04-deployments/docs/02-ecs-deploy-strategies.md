---
title: "Deploying to ECS: rolling, circuit breaker, blue/green"
tech: AWS ECS, GitHub Actions
version: Amazon ECS (rolling updates, deployment circuit breaker, built-in blue/green, canary, linear), aws-actions/amazon-ecs-render-task-definition, aws-actions/amazon-ecs-deploy-task-definition
date: 2026-11-07
covers: [4, 5, 6]
---
# Deploying to ECS: rolling, circuit breaker, blue/green
[← Overview](00-overview.md)

## Why it matters
- A deploy with a missing environment variable crashes every new task. ECS keeps retrying for an hour, the pipeline reports success, and capacity slowly drains.
- `minimumHealthyPercent` is 0, so ECS stops all old tasks before new ones are healthy. Each deploy is a two-minute outage.
- A risky change goes to 100% of traffic at once. A 10% canary would have shown the error spike in minutes.

## Concepts

### What a deploy does on ECS
| Step | Who |
|:--|:--|
| 1. Render the task definition with the new image digest | CI |
| 2. Register a new revision (`shop-api:42`) | CI |
| 3. Update the service to that revision | CI |
| 4. Start new tasks, wait for health checks, register with the ALB | ECS |
| 5. Drain and stop old tasks | ECS + ALB |
| 6. Wait for "steady state" and fail the job if it doesn't come | CI (`wait-for-service-stability`) |

### Rolling deployments
| Setting | Meaning | Typical |
|:--|:--|:--|
| `minimumHealthyPercent` | tasks that must stay healthy during the deploy | 100 |
| `maximumPercent` | extra tasks allowed during the deploy | 200 |
| Deployment circuit breaker | stops a deployment whose tasks keep failing | on |
| `rollback = true` | returns to the last working revision automatically | on |
| `healthCheckGracePeriodSeconds` | ignore ALB health while booting | 30–90 |
| CloudWatch alarms (optional) | roll back when chosen alarms fire during the deploy | 5xx rate, latency |

### Strategies
| Strategy | How | Good for | Cost |
|:--|:--|:--|:--|
| **Rolling** (default) | replace tasks gradually | most deploys | old and new run side by side briefly |
| Blue/green (ECS built-in) | full new set, switch ALB traffic at once, bake time, instant rollback | risky changes, fast rollback | double capacity during the deploy |
| Canary | small % of traffic first, then the rest | catching errors with little impact | needs good metrics and alarms |
| Linear | shift traffic in equal steps | gradual exposure | slower deploys |
| Feature flags | deploy dark, release by flag ([lesson 04](04-flags-frontend-releases.md)) | product changes | flag cleanup |

Both versions run at the same time during every strategy except a full stop/start. Code and schema must therefore be **backward-compatible across one version** ([lesson 03](03-migrations-environments-rollbacks.md)).

### When a deploy goes wrong
| Symptom | Likely cause |
|:--|:--|
| Tasks stop right after starting | crash on boot: missing env/secret, bad config, migration not applied |
| Tasks fail health checks | wrong port or path, slow startup, readiness depends on something down |
| `CannotPullContainerError` | wrong image reference, missing ECR permissions, no route to ECR |
| `ResourceInitializationError` | secrets can't be fetched (execution role, VPC endpoint/NAT) |
| `OutOfMemoryError` | task memory too small for the new version |

## Example
`.github/workflows/deploy.yml` — part 2: deploy a given image to an environment (used for staging and production).
```yaml
  deploy-staging:
    needs: [build, migrate-staging]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@<40-char-commit-sha>
      - uses: aws-actions/configure-aws-credentials@<40-char-commit-sha>
        with:
          role-to-assume: ${{ vars.DEPLOY_ROLE_ARN }}       # per-environment variable
          aws-region: eu-central-1
      - id: render
        uses: aws-actions/amazon-ecs-render-task-definition@<40-char-commit-sha>
        with:
          task-definition: deploy/taskdef.staging.json
          container-name: api
          image: ${{ needs.build.outputs.image }}          # repository@sha256:… from the build job
      - uses: aws-actions/amazon-ecs-deploy-task-definition@<40-char-commit-sha>
        with:
          task-definition: ${{ steps.render.outputs.task-definition }}
          cluster: shop-staging
          service: api
          wait-for-service-stability: true                # fail the job if the rollout doesn't settle
```
Service deployment settings (Terraform, owned by [03-iac](../../03-iac/README.md)):
```hcl
resource "aws_ecs_service" "api" {
  # …
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  alarms {
    enable      = true
    rollback    = true
    alarm_names = [aws_cloudwatch_metric_alarm.api_5xx.alarm_name]
  }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "shop-prod-api-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix, TargetGroup = aws_lb_target_group.api.arn_suffix }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 25
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
}
```
Watching and diagnosing a rollout:
```bash
aws ecs describe-services --cluster shop-prod --services api \
  --query 'services[0].deployments[].{status:status,rollout:rolloutState,running:runningCount,desired:desiredCount,reason:rolloutStateReason}'
aws ecs describe-services --cluster shop-prod --services api --query 'services[0].events[:10].message'
aws ecs list-tasks --cluster shop-prod --service-name api --desired-status STOPPED
aws ecs describe-tasks --cluster shop-prod --tasks <task-arn> --query 'tasks[0].{reason:stoppedReason,containers:containers[].{exit:exitCode,reason:reason}}'
```

## Production patterns
- **Rolling deploys with 100/200 capacity, circuit breaker, and automatic rollback** as the baseline.
- **Alarm-based rollback** on 5xx rate (and latency) during deployments.
- **The pipeline waits for stability** and fails visibly; a green pipeline means the new version is running.
- **Blue/green or canary for high-risk changes**, with metrics good enough to judge them.
- **Every version backward-compatible with the previous one**, because both run at once.

## Mistakes
Wrong: `minimumHealthyPercent = 0` to deploy faster. All old tasks stop before new ones are healthy. Right: 100/200, and faster health checks if speed matters.

Wrong: a pipeline that calls `update-service` and finishes. Failures surface later, as alerts. Right: `wait-for-service-stability: true`.

Wrong: no circuit breaker. A broken revision crash-loops for hours while ECS keeps trying. Right: circuit breaker with rollback.

Wrong: canary without metrics. Traffic shifts by schedule while errors go unnoticed. Right: alarms that stop and roll back the shift.

## Check yourself
1. What do `minimumHealthyPercent` 100 and `maximumPercent` 200 mean during a deploy?
2. What does the deployment circuit breaker do, and what does it not catch?
3. Why must each version be compatible with the previous one, whatever the strategy?

<details>
<summary>Answers</summary>

1. ECS must keep the full desired count of healthy tasks running (100%) and may start up to the same number again (200%) for the new version, so new tasks start and become healthy before old ones are stopped. Capacity never drops during the deploy.
2. It watches whether new tasks reach a running, healthy state; if they keep failing to start or failing health checks, it stops the deployment and (with rollback) returns to the last working revision. It doesn't catch versions that start fine but return wrong results or errors to users; alarm-based rollback and monitoring cover that.
3. During rolling, canary, and linear deploys both versions serve traffic at once, and even blue/green may need to roll back to the old version against the new schema or data. Requests, messages, cache entries, and the database must work for both.
</details>

## Sources
- [Amazon ECS — Rolling update deployments](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html)
- [Amazon ECS — Deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html)
- [Amazon ECS — CloudWatch alarms for deployment failure detection](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-alarm-failure.html)
- [Amazon ECS — Blue/green deployments](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-blue-green.html)
- [aws-actions/amazon-ecs-render-task-definition](https://github.com/aws-actions/amazon-ecs-render-task-definition)
