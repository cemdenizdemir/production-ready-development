---
title: Cloud
module: 04-shipping
tech: AWS (ECS Fargate, RDS, ElastiCache, S3), MongoDB Atlas
---
# Cloud
[← Dashboard](../../../README.md)

## Checklist
- [ ] ⭐ AWS foundations: an account per environment, Organizations, IAM Identity Center for people
- [ ] ⭐ IAM: roles instead of keys, least privilege, task roles vs execution roles
- [ ] ⭐ Networking: VPC, public and private subnets, security groups, NAT, VPC endpoints
- [ ] ⭐ Running containers on ECS Fargate: task definitions, services, Graviton, Fargate Spot
- [ ] RDS for PostgreSQL in production: Multi-AZ, roles, TLS, parameter groups, protection
- [ ] ElastiCache (Valkey): replication, failover, encryption, separate cache and queue clusters
- [ ] S3 and CloudFront: private buckets, origin access control, static assets
- [ ] Secrets and configuration: Secrets Manager, Parameter Store, injecting into tasks, rotation
- [ ] DNS and TLS: Route 53 aliases, ACM certificates, ALB listeners and rules
- [ ] MongoDB Atlas: tiers, region, PrivateLink, users, backups
- [ ] Cost awareness: what costs money, budgets, anomaly detection, Graviton, Spot, Savings Plans
- [ ] Platform logs and metrics: CloudWatch Logs retention, Container Insights, alarms

## Docs
- [00 · Overview](docs/00-overview.md)
- [01 · Accounts, IAM, and networking](docs/01-accounts-iam-networking.md)
- [02 · ECS Fargate, load balancing, DNS, and logs](docs/02-ecs-alb-dns-logs.md)
- [03 · Managed data: RDS, ElastiCache, S3, MongoDB Atlas](docs/03-managed-data.md)
- [04 · Secrets, configuration, and cost](docs/04-secrets-and-cost.md)
- [Cheatsheet](docs/cheatsheet.md)

## Tasks
_None yet. Run `/learn typescript/04-shipping/02-cloud mode=tasks` when you are ready to build._
