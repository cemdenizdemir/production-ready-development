---
title: Accounts, IAM, and networking
tech: AWS Organizations, IAM, Amazon VPC
version: AWS Organizations, IAM Identity Center, IAM roles and policies, Amazon VPC with security groups and VPC endpoints
date: 2026-11-07
covers: [1, 2, 3]
---
# Accounts, IAM, and networking
[← Overview](00-overview.md)

## Why it matters
- Staging and production share one AWS account. A cleanup script meant for staging deletes a production bucket, because nothing separated them.
- A developer's access key with `AdministratorAccess` leaks in a public repo. Within minutes bots start crypto-mining instances in every region.
- The database sits in a public subnet with a security group open to `0.0.0.0/0` "temporarily". It's found by a scanner the same week.

## Concepts

### Accounts
| Account | Holds |
|:--|:--|
| Management | AWS Organizations, billing, nothing else |
| Security / log archive | CloudTrail, Config, GuardDuty findings, central logs |
| Shared services | ECR, CI roles, DNS (optional) |
| `dev`, `staging`, `prod` | one workload account per environment |
| Sandbox | personal experiments with budgets |

Accounts are the strongest isolation boundary AWS has: separate permissions, quotas, and bills. Service control policies (SCPs) in Organizations set guardrails for whole accounts (allowed regions, no disabling CloudTrail). Also seen: AWS Control Tower to set this up.

### Identity
| Who | How |
|:--|:--|
| People | IAM Identity Center (SSO) with permission sets per account; MFA required |
| CI (GitHub Actions) | OIDC federation to a role; no stored keys ([04-deployments](../../04-deployments/README.md)) |
| ECS tasks | task role (app permissions) + execution role (pull image, write logs, read injected secrets) |
| Break-glass | a locked-down admin role for emergencies, alerted on use |
| avoid | IAM users with access keys, root account use, shared logins |

### IAM policies
| Practice | Example |
|:--|:--|
| Least privilege | specific actions on specific ARNs, not `*` |
| Conditions | `aws:SourceAccount`, `ses:FromAddress`, `aws:RequestedRegion` |
| Separate roles per service | API, worker, web, migrations each get their own |
| Permission boundaries / SCPs | caps on what roles can ever do |
| IAM Access Analyzer | finds public and cross-account access, unused permissions |
| Review | CloudTrail shows who did what; unused permissions get removed |

### Networking
| Piece | Use |
|:--|:--|
| VPC (`10.0.0.0/16`) | your private network, across 2–3 AZs |
| Public subnets | ALB and NAT gateways only |
| Private app subnets | ECS tasks, no public IPs |
| Private data subnets | RDS, ElastiCache; no internet route at all |
| Security groups | stateful allow-lists that reference each other |
| NAT gateway | outbound internet for private subnets (Stripe, SES APIs); one per AZ for HA |
| VPC endpoints | private access to S3 (gateway endpoint, free), ECR, Secrets Manager, CloudWatch Logs (interface endpoints) |
| Network ACLs | coarse subnet-level rules; usually left default |

Security group rules for this stack:
| Group | Inbound from | Port |
|:--|:--|:--|
| `alb-sg` | internet (`0.0.0.0/0`, `::/0`) | 443 (and 80 for redirect) |
| `web-sg` | `alb-sg` | 3000 |
| `api-sg` | `alb-sg` | 3000 |
| `worker-sg` | nothing | — |
| `db-sg` | `api-sg`, `worker-sg` | 5432 |
| `cache-sg` | `api-sg`, `worker-sg` | 6379 |

## Example
Task role trust policy — only ECS tasks in this account can assume it.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": { "aws:SourceAccount": "123456789012" },
        "ArnLike": { "aws:SourceArn": "arn:aws:ecs:eu-central-1:123456789012:*" }
      }
    }
  ]
}
```
API task role permissions — exactly what the code calls, on exactly these resources.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Uploads",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::shop-prod-uploads/*"
    },
    {
      "Sid": "SendEmail",
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": [
        "arn:aws:ses:eu-central-1:123456789012:identity/shop.com",
        "arn:aws:ses:eu-central-1:123456789012:configuration-set/transactional"
      ]
    }
  ]
}
```
`infra/modules/network/main.tf` — a VPC with the community module (details of Terraform in [03-iac](../../03-iac/README.md)).
```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.0"

  name = "shop-prod"
  cidr = "10.0.0.0/16"
  azs  = ["eu-central-1a", "eu-central-1b", "eu-central-1c"]

  public_subnets   = ["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24"]
  private_subnets  = ["10.0.10.0/23", "10.0.12.0/23", "10.0.14.0/23"]   # ECS tasks
  database_subnets = ["10.0.20.0/24", "10.0.21.0/24", "10.0.22.0/24"]   # RDS, ElastiCache

  enable_nat_gateway     = true
  one_nat_gateway_per_az = true      # an AZ failure doesn't cut off the others (dev: single_nat_gateway = true)
  create_database_subnet_route_table = true
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = module.vpc.vpc_id
  service_name      = "com.amazonaws.eu-central-1.s3"
  vpc_endpoint_type = "Gateway"                                   # free; S3 traffic skips the NAT
  route_table_ids   = module.vpc.private_route_table_ids
}

resource "aws_vpc_security_group_ingress_rule" "db_from_api" {
  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = aws_security_group.api.id       # by group, not by IP range
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
```
Signing in as a person, from the CLI:
```bash
aws configure sso                 # once: pick the Identity Center start URL, account, and permission set
aws sso login --profile shop-prod-readonly
aws sts get-caller-identity --profile shop-prod-readonly
```

## Production patterns
- **One account per environment** under AWS Organizations, with SCP guardrails and a separate security/log account.
- **No long-lived keys**: Identity Center for people, OIDC for CI, roles for tasks.
- **One role per service** with resource-scoped permissions; Access Analyzer and CloudTrail to find excess.
- **Private subnets for everything except the ALB and NAT**; databases without any internet route.
- **Security groups that reference other groups**, plus VPC endpoints to keep AWS traffic private and off the NAT bill.

## Mistakes
Wrong: access keys for an app or a pipeline.
```bash
AWS_ACCESS_KEY_ID=AKIA… AWS_SECRET_ACCESS_KEY=… # in a .env, a CI secret, or a laptop: leak = account takeover
```
Right: task roles for apps, OIDC roles for CI, SSO for people.

Wrong: `"Action": "*", "Resource": "*"` "until we know what we need". It never gets narrowed. Right: start from the calls the code makes; widen with evidence.

Wrong: a database in a public subnet or a security group open to the internet. Right: data subnets without internet routes, access only from the app security groups; use ECS Exec or a bastion with SSM for admin work.

Wrong: one NAT gateway for three AZs in production. If its AZ fails, every private subnet loses outbound access. Right: one per AZ in production (a single one is fine for dev).

## Check yourself
1. Why use separate AWS accounts for environments instead of tags or naming?
2. What's the difference between an ECS task role and an execution role?
3. Why reference security groups instead of IP ranges in rules?

<details>
<summary>Answers</summary>

1. Accounts are hard boundaries: permissions, quotas, and blast radius stop at the account edge, and bills are separated. Tags and names are conventions that a mistake or a broad policy can cross.
2. The execution role is used by ECS itself to start the task: pull the image from ECR, write logs, and fetch secrets to inject. The task role is what your application code uses at runtime to call AWS (S3, SES, SQS).
3. Task IPs change constantly. A rule like "db-sg accepts 5432 from api-sg" follows the tasks automatically and allows exactly that path, while IP ranges either break or end up too broad.
</details>

## Sources
- [AWS — Organizing your environment using multiple accounts](https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html)
- [AWS IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)
- [IAM — Security best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Amazon ECS — Task IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [Amazon VPC — Security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)
- [terraform-aws-modules/vpc](https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/latest)
