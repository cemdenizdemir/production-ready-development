---
title: "Managed data: RDS, ElastiCache, S3, MongoDB Atlas"
tech: AWS RDS, AWS ElastiCache, AWS S3, AWS CloudFront, MongoDB Atlas
version: RDS for PostgreSQL 18, ElastiCache for Valkey 8, S3 + CloudFront (origin access control), MongoDB Atlas dedicated clusters, Terraform AWS provider 6
date: 2026-11-07
covers: [5, 6, 7, 10]
---
# Managed data: RDS, ElastiCache, S3, MongoDB Atlas
[← Overview](00-overview.md)

## Why it matters
- The production database is a single-AZ `db.t3.micro` created in the console. A hardware failure takes the shop down for 40 minutes, and nobody knows its settings.
- BullMQ runs on an ElastiCache cluster with the default `volatile-lru` policy. Under memory pressure, Redis evicts queue keys and jobs vanish.
- The app connects to Postgres with `ssl: { rejectUnauthorized: false }`. Traffic is encrypted, but anyone in the middle can impersonate the database.

## Concepts

### RDS for PostgreSQL
| Setting | Production choice |
|:--|:--|
| Deployment | Multi-AZ (standby in another AZ, automatic failover in ~1–2 min); Multi-AZ DB cluster for readable standbys and faster failover |
| Instance class | Graviton (`db.t4g` for small, `db.m7g`/`db.r7g` or newer for production) |
| Storage | gp3 with storage autoscaling and an upper limit |
| Master password | managed by RDS in Secrets Manager (`manage_master_user_password`) |
| App users | separate roles: `app` (DML only) and `migrator` (DDL); not the master user |
| Encryption | at rest with KMS (choose at creation); TLS enforced (`rds.force_ssl`) |
| Parameter group | custom group (`postgres18` family) for `log_min_duration_statement`, `pg_stat_statements` |
| Backups | automated backups with point-in-time recovery ([05-data-safety](../../05-data-safety/README.md)) |
| Protection | deletion protection, final snapshot on delete |
| Insight | Performance Insights / Database Insights, Enhanced Monitoring |
| Upgrades | maintenance windows; blue/green deployments for major versions |
| Also seen | Aurora PostgreSQL, RDS Proxy ([03-backend/09-scalability](../../../03-backend/09-scalability/docs/03-scaling-postgresql.md)) |

### ElastiCache (Valkey)
| Setting | Production choice |
|:--|:--|
| Engine | Valkey (Redis-compatible, cheaper); Redis OSS also available, Redis 8 isn't |
| Topology | node-based replication group: primary + replica, Multi-AZ automatic failover |
| Separate clusters | cache (`allkeys-lru`) and queues/sessions (`noeviction`) |
| Encryption | in transit (TLS, `rediss://`) and at rest |
| Auth | AUTH token or RBAC users |
| Serverless | also offered; check eviction and cluster-mode requirements before putting BullMQ on it |
| Cluster mode | for sharding; BullMQ then needs a hash-tag prefix (`{bull}`) |

### S3 and CloudFront
| Use | Setup |
|:--|:--|
| Uploads, exports | private bucket, presigned URLs ([03-backend/12-integrations lesson 04](../../../03-backend/12-integrations/docs/04-files-with-s3.md)) |
| Next.js static assets | bucket behind CloudFront with origin access control (OAC); `assetPrefix` points at it |
| Public product images | CloudFront + OAC, long `Cache-Control`, immutable keys |
| Logs and backups | separate buckets with lifecycle rules and Object Lock where needed |

### MongoDB Atlas
| Topic | Practice |
|:--|:--|
| Tier | dedicated cluster (M10+) for production; Flex for development |
| Region | same AWS region as the app (latency, data transfer cost) |
| Network | AWS PrivateLink or VPC peering; IP access list never `0.0.0.0/0` |
| Users | one database user per app with the least role needed |
| Connection | `mongodb+srv://` string from Secrets Manager |
| Backups | cloud backups with point-in-time restore ([05-data-safety](../../05-data-safety/README.md)) |
| When | document-shaped data from [03-backend/03-databases lesson 05](../../../03-backend/03-databases/docs/05-mongodb-and-choosing.md); Postgres stays the default |

## Example
`infra/modules/data/rds.tf`
```hcl
resource "aws_db_instance" "main" {
  identifier                   = "shop-prod"
  engine                       = "postgres"
  engine_version               = "18"
  instance_class               = "db.m7g.large"
  allocated_storage            = 100
  max_allocated_storage        = 500                       # storage autoscaling ceiling
  storage_type                 = "gp3"
  storage_encrypted            = true
  multi_az                     = true
  db_subnet_group_name         = module.vpc.database_subnet_group_name
  vpc_security_group_ids       = [aws_security_group.db.id]
  username                     = "shop_admin"
  manage_master_user_password  = true                      # password lives in Secrets Manager, not in state
  parameter_group_name         = aws_db_parameter_group.pg18.name
  backup_retention_period      = 14
  deletion_protection          = true
  skip_final_snapshot          = false
  final_snapshot_identifier    = "shop-prod-final"
  performance_insights_enabled = true
  auto_minor_version_upgrade   = true
  maintenance_window           = "sun:03:00-sun:04:00"

  lifecycle { prevent_destroy = true }
}

resource "aws_db_parameter_group" "pg18" {
  name   = "shop-pg18"
  family = "postgres18"
  parameter {
    name  = "log_min_duration_statement"
    value = "500"                                            # log statements slower than 500 ms
  }
}
```
`infra/modules/data/valkey.tf` — the queue cluster with `noeviction`.
```hcl
resource "aws_elasticache_parameter_group" "queues" {
  name   = "shop-queues"
  family = "valkey8"
  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"                                     # BullMQ requires it
  }
}

resource "aws_elasticache_replication_group" "queues" {
  replication_group_id       = "shop-queues"
  description                = "BullMQ queues and sessions"
  engine                     = "valkey"
  node_type                  = "cache.m7g.large"
  num_cache_clusters         = 2                             # primary + replica
  automatic_failover_enabled = true
  multi_az_enabled           = true
  parameter_group_name       = aws_elasticache_parameter_group.queues.name
  subnet_group_name          = aws_elasticache_subnet_group.data.name
  security_group_ids         = [aws_security_group.cache.id]
  transit_encryption_enabled = true
  at_rest_encryption_enabled = true
  auth_token                 = random_password.valkey.result
}
```
Connecting with verified TLS from Node:
```ts
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createClient } from 'redis';

// The RDS CA bundle is downloaded into the image at build time:
// https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
export const pool = new Pool({
  connectionString: config.db.url,
  ssl: { ca: readFileSync('/app/certs/rds-global-bundle.pem', 'utf8'), rejectUnauthorized: true },
});

export const redis = createClient({ url: config.redis.url });   // rediss://:<token>@<primary-endpoint>:6379 → TLS
```
App and migration roles in Postgres (run once by the migrator, with the RDS-managed admin password):
```sql
CREATE ROLE app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE shop TO app;
GRANT USAGE ON SCHEMA public TO app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;
ALTER ROLE app SET statement_timeout = '5s';
```

## Production patterns
- **Multi-AZ RDS on Graviton** with managed master password, separate app and migration roles, deletion protection, and PITR backups.
- **Verified TLS** to Postgres (CA bundle) and Valkey (`rediss://`).
- **Two Valkey clusters**: `allkeys-lru` for caching, `noeviction` for BullMQ and sessions.
- **Private S3 buckets behind CloudFront OAC** for anything public; presigned URLs for the rest.
- **Atlas over PrivateLink**, same region, least-privilege users, credentials in Secrets Manager.

## Mistakes
Wrong: disabling certificate checks.
```ts
new Pool({ connectionString, ssl: { rejectUnauthorized: false } }); // encrypted, but no proof it's your database
```
Right: pass the RDS CA bundle and keep `rejectUnauthorized: true`.

Wrong: the app connects as the master user. A SQL injection can drop tables or read every schema. Right: an `app` role with DML only; DDL only for migrations.

Wrong: one Valkey cluster with an eviction policy for both cache and queues. Jobs disappear under memory pressure. Right: separate clusters, `noeviction` for queues.

Wrong: Atlas network access `0.0.0.0/0` "because Fargate IPs change". Right: PrivateLink or peering, or at least the NAT gateways' fixed IPs.

## Check yourself
1. What does Multi-AZ give you, and what doesn't it protect against?
2. Why separate cache and queue clusters in ElastiCache?
3. How should the app authenticate to RDS, and with which privileges?

<details>
<summary>Answers</summary>

1. A synchronous standby in another AZ with automatic failover, so hardware or AZ failures cause a short interruption instead of an outage. It doesn't protect against bad writes, deletes, or corruption, which are replicated instantly; backups and point-in-time recovery cover those.
2. They need opposite eviction policies: a cache should evict old keys under memory pressure (`allkeys-lru`), while queues and sessions must never lose keys (`noeviction`). Separate clusters also keep a cache stampede from hurting job processing.
3. With its own role (not the master user) over verified TLS, using credentials injected from Secrets Manager; the role can read and write data (DML) but can't change the schema, which only the migration role can do.
</details>

## Sources
- [Amazon RDS — Multi-AZ deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html)
- [Amazon RDS — Password management with Secrets Manager](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html)
- [Amazon RDS — Using SSL/TLS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
- [Amazon ElastiCache — Valkey](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.html)
- [Amazon CloudFront — Origin access control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [MongoDB Atlas — Private endpoints](https://www.mongodb.com/docs/atlas/security-private-endpoint/)
