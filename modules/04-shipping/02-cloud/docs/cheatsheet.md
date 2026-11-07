---
title: Cloud cheatsheet
tech: AWS (ECS Fargate, RDS, ElastiCache, S3), MongoDB Atlas
version: ECS on Fargate (Graviton, Spot), ALB, RDS for PostgreSQL 18, ElastiCache for Valkey 8, S3 + CloudFront, Route 53, ACM, Secrets Manager, MongoDB Atlas
date: 2026-11-07
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
---
# Cloud cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Accounts and identity
| Item | Use |
|:--|:--|
| ⭐ AWS Organizations | one account per environment + management + security/log |
| SCPs | account-wide guardrails (regions, no CloudTrail disable) |
| ⭐ IAM Identity Center | SSO for people, permission sets, MFA |
| ⭐ OIDC roles | CI without stored keys |
| ⭐ Task role / execution role | app permissions / pull, logs, secrets |
| Break-glass role | emergencies only, alerted |
| Control Tower | landing zone setup (also seen) |
| avoid | IAM users with keys, root account use |

## IAM practices
| Practice | Example |
|:--|:--|
| ⭐ Least privilege | `s3:PutObject` on `arn:aws:s3:::shop-prod-uploads/*` |
| Conditions | `aws:SourceAccount`, `aws:SourceArn`, `ses:FromAddress` |
| One role per service | api, worker, web, migrate |
| IAM Access Analyzer | public/cross-account access, unused permissions |
| CloudTrail | who did what, when |
| `aws sts get-caller-identity` | which identity am I? |

## Networking
| Piece | Use |
|:--|:--|
| ⭐ VPC across 2–3 AZs | private network |
| ⭐ Public subnets | ALB, NAT only |
| ⭐ Private subnets | ECS tasks, no public IPs |
| Data subnets | RDS, ElastiCache, no internet route |
| ⭐ Security groups referencing groups | `db-sg` allows 5432 from `api-sg` |
| NAT gateway per AZ | outbound internet (prod) |
| ⭐ S3 gateway endpoint | free, skips NAT |
| Interface endpoints | ECR, Secrets Manager, Logs |
| Community module | `terraform-aws-modules/vpc/aws` |

## ECS on Fargate
| Item | Use |
|:--|:--|
| ⭐ Task definition | image, CPU/memory, env, secrets, logs, roles, health |
| ⭐ Service | desired count, rollouts, ALB registration |
| `awsvpc` | ENI + security group per task |
| ⭐ `assignPublicIp: DISABLED` | private tasks |
| `runtimePlatform.cpuArchitecture: ARM64` | Graviton |
| `FARGATE_SPOT` | workers (2-minute interruption notice) |
| ⭐ Deployment circuit breaker + rollback | failed deploys revert |
| `healthCheckGracePeriodSeconds` | boot time |
| `enable_execute_command` | ECS Exec shell |
| `ignore_changes = [task_definition, desired_count]` | CI deploys, autoscaling scales |
| `readonlyRootFilesystem` + `/tmp` volume | harder to tamper with |

## Fargate sizes
| vCPU | Memory |
|:--|:--|
| 0.25 | 0.5–2 GB |
| 0.5 | 1–4 GB |
| 1 | 2–8 GB |
| 2 | 4–16 GB |
| 4 | 8–30 GB |
| 8 | 16–60 GB |
| 16 | 32–120 GB |

## Application Load Balancer
| Setting | Value |
|:--|:--|
| ⭐ 80 → 443 redirect | HTTPS only |
| ⭐ 443 + ACM cert | `ELBSecurityPolicy-TLS13-1-2-2021-06` |
| Host rules | `api.shop.com` → api TG, default → web TG |
| ⭐ Target type `ip` | Fargate |
| Health check | `/health/ready` |
| Deregistration delay | 30–60 s |
| Idle timeout | 60 s (Node keep-alive 65 s) |
| Access logs | S3 |
| AWS WAF | managed rules (also seen) |

## DNS and TLS
| Item | Use |
|:--|:--|
| ⭐ Route 53 alias records | apex and subdomains → ALB/CloudFront |
| ⭐ ACM, DNS validation | free, auto-renewing certificates |
| CloudFront certificate | in `us-east-1` |
| CAA record | allowed certificate authorities |

## RDS for PostgreSQL
| Setting | Value |
|:--|:--|
| ⭐ Multi-AZ | standby + failover (~1–2 min) |
| Multi-AZ DB cluster | readable standbys, faster failover |
| Graviton classes | `db.t4g`, `db.m7g`, `db.r7g` (or newer) |
| gp3 + `max_allocated_storage` | storage autoscaling |
| ⭐ `manage_master_user_password = true` | password in Secrets Manager |
| ⭐ App role (DML) vs migrator (DDL) | least privilege |
| ⭐ TLS verified | RDS CA bundle, `rejectUnauthorized: true` |
| Parameter group `postgres18` | logging, extensions |
| ⭐ `deletion_protection`, final snapshot | protection |
| Backups | retention + PITR |
| Blue/green deployments | major upgrades |

## ElastiCache (Valkey)
| Setting | Value |
|:--|:--|
| ⭐ Engine | Valkey (or Redis OSS); not Redis 8 |
| Replication group | primary + replica, Multi-AZ failover |
| ⭐ Separate clusters | cache `allkeys-lru`, queues `noeviction` |
| Parameter group family | `valkey8` |
| ⭐ TLS | `transit_encryption_enabled`, `rediss://` |
| Auth | AUTH token or RBAC |
| Cluster mode | sharding; BullMQ prefix `{bull}` |

## S3 and CloudFront
| Use | Setup |
|:--|:--|
| ⭐ Private buckets | Block Public Access on |
| ⭐ CloudFront + OAC | public assets from private buckets |
| Next.js assets | `assetPrefix` → CloudFront |
| Uploads | presigned URLs |
| Lifecycle rules | expire temp data, transition old data |

## MongoDB Atlas
| Topic | Practice |
|:--|:--|
| Tier | dedicated (M10+) prod, Flex dev |
| Region | same as the app |
| ⭐ Network | PrivateLink / peering; never `0.0.0.0/0` |
| Users | per app, least role |
| Connection | `mongodb+srv://` from Secrets Manager |
| Backups | cloud backups + PITR |

## Secrets and configuration
| Item | Use |
|:--|:--|
| ⭐ Secrets Manager | secrets, rotation, JSON secrets |
| SSM Parameter Store | config, cheap `SecureString` |
| ⭐ Task `secrets` (`valueFrom`) | injected at task start |
| JSON key reference | `…:secret:name-AbCdEf:secret_key::` |
| ⭐ Rotate → redeploy | tasks read secrets only at start |
| Execution role scope | only its own secrets |
| `aws ecs update-service --force-new-deployment` | pick up new secret values |

## Logs and platform metrics
| Item | Use |
|:--|:--|
| ⭐ `awslogs` driver | stdout → CloudWatch Logs |
| ⭐ `retention_in_days` | default is forever |
| `mode: non-blocking` | logging never blocks the app |
| Container Insights | service CPU/memory/restarts |
| Alarms | ALB 5xx, unhealthy hosts, RDS storage, cache memory |
| Grafana CloudWatch data source | one place for dashboards |

## Cost drivers (us-east-1 list prices)
| Item | Price shape |
|:--|:--|
| ⭐ NAT gateway | ~$0.045/h + ~$0.045/GB processed |
| ALB | ~$0.0225/h + capacity units |
| Public IPv4 | ~$0.005/h per address |
| Cross-AZ transfer | ~$0.01/GB each way |
| ⭐ CloudWatch Logs | ~$0.50/GB ingested |
| Secrets Manager | ~$0.40/secret/month |
| RDS Multi-AZ | about 2× single-AZ |

## Cost levers
| Lever | Saves on |
|:--|:--|
| ⭐ Graviton | Fargate, RDS, ElastiCache |
| Fargate Spot | workers |
| Compute Savings Plans | steady Fargate usage |
| ⭐ VPC endpoints | NAT processing |
| ⭐ Log levels + retention | CloudWatch |
| ⭐ Scale non-prod to 0 at night | idle environments |
| ⭐ Budgets + anomaly detection | surprises |
| `default_tags` | cost allocation |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| Shared account for all environments | mistakes cross environments | account per environment |
| Access keys for apps/CI | leak = account takeover | roles, OIDC |
| Public IPs on tasks | exposed, billed | private subnets + NAT |
| Secrets in `environment` | readable in the task definition | `secrets` |
| Single NAT in prod | AZ failure cuts outbound | NAT per AZ |
| `rejectUnauthorized: false` | DB impersonation | CA bundle |
| App uses the master DB user | SQL injection drops tables | app role (DML) |
| Eviction policy on the queue cluster | lost jobs | `noeviction` cluster |
| Log groups without retention | growing bill | retention |
| Terraform owns task definition revisions | applies roll back deploys | `ignore_changes` |
| CloudFront cert outside `us-east-1` | can't attach | request it in `us-east-1` |
| Atlas open to `0.0.0.0/0` | exposed database | PrivateLink/peering |

## Sources
| Source | Link |
|:--|:--|
| Multiple AWS accounts | https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html |
| IAM best practices | https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html |
| ECS task definition parameters | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html |
| ECS secrets | https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html |
| RDS Multi-AZ | https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html |
| ElastiCache | https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html |
| AWS Pricing Calculator | https://calculator.aws/ |
