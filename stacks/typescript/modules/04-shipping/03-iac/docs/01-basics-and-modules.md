---
title: Terraform basics and modules
tech: Terraform, AWS
version: Terraform 1.14, AWS provider 6.x
date: 2026-11-07
covers: [1, 2, 5]
---
# Terraform basics and modules
[← Overview](00-overview.md)

## Why it matters
- Staging was built by hand a year ago. Production is built "the same way", but staging has a different health check path and a public bucket nobody remembers creating.
- Three services each have 200 lines of copy-pasted ECS configuration. A fix to one log retention setting is applied to one service and forgotten in two.
- A teammate runs `terraform apply` with provider version 6.x while CI uses 5.x, and the state can no longer be read by the older version.

## Concepts

### Why infrastructure as code
| Benefit | Means |
|:--|:--|
| Reviewable | infrastructure changes go through pull requests and plans |
| Repeatable | a new environment is the same code with different inputs |
| Recoverable | rebuild after a disaster from code and backups |
| Documented | the code is the inventory |
| Drift visible | a plan shows when reality differs from code |

### The language
| Construct | Example | Purpose |
|:--|:--|:--|
| `terraform { }` | `required_version`, `required_providers`, `backend` | settings and version pins |
| `provider` | `provider "aws" { region = "eu-central-1" }` | API configuration |
| `resource` | `resource "aws_s3_bucket" "uploads" { … }` | something Terraform creates and manages |
| `data` | `data "aws_caller_identity" "current" {}` | read something that exists |
| `variable` | `variable "env" { type = string }` | inputs, with `validation` |
| `output` | `output "alb_dns" { value = aws_lb.main.dns_name }` | values for callers and humans |
| `locals` | `locals { name = "shop-${var.env}" }` | named expressions |
| `module` | `module "vpc" { source = "…" }` | reusable groups of resources |
| `for_each` / `count` | one resource per map entry | repetition without copy-paste |
| `dynamic` blocks | optional nested blocks | conditional configuration |
| `lifecycle` | `prevent_destroy`, `ignore_changes`, `create_before_destroy` | change behavior |

References between resources (`aws_security_group.api.id`) create the dependency graph; Terraform creates and destroys in the right order. Prefer `for_each` with a map over `count`, so removing one item doesn't renumber and replace the others.

### Modules
| Practice | Why |
|:--|:--|
| Standard files | `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `README.md` |
| Small, purposeful modules | `network`, `ecs-service`, `data`, `cdn`; not one module for everything |
| Typed, validated inputs | errors at plan time, not at apply time |
| Outputs for what callers need | IDs and ARNs, not whole resources |
| Versioned | registry versions or git tags (`?ref=v1.4.0`) |
| Community modules | `terraform-aws-modules/*` for VPC, ALB, RDS; read what they create |
| No providers inside reusable modules | the root module configures providers |

## Example
`infra/envs/prod/versions.tf` — pin Terraform and providers; commit `.terraform.lock.hcl`.
```hcl
terraform {
  required_version = "~> 1.14"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    random = { source = "hashicorp/random", version = "~> 3.7" }
  }
}
```
`infra/modules/ecs-service/variables.tf`
```hcl
variable "name" {
  type        = string
  description = "Service name, for example api"
}

variable "cpu" {
  type    = number
  default = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.cpu)
    error_message = "cpu must be a supported Fargate size."
  }
}

variable "memory" {
  type    = number
  default = 2048
}

variable "port" {
  type    = number
  default = 3000
}

variable "target_group_arn" {
  type        = string
  default     = null
  description = "Register with this ALB target group; null for workers"
}

variable "cluster_arn" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "log_retention_days" {
  type    = number
  default = 30
}
```
`infra/modules/ecs-service/main.tf` (abbreviated: task definition and security group omitted)
```hcl
resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.this.id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = var.target_group_arn == null ? [] : [var.target_group_arn]
    content {
      target_group_arn = load_balancer.value
      container_name   = var.name
      container_port   = var.port
    }
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]   # CI deploys revisions, autoscaling sets the count
  }
}
```
`infra/modules/ecs-service/outputs.tf`
```hcl
output "service_name" {
  value = aws_ecs_service.this.name
}

output "security_group_id" {
  value = aws_security_group.this.id
}
```
`infra/envs/prod/services.tf` — one module call per service from a map.
```hcl
locals {
  services = {
    api    = { cpu = 1024, memory = 2048, public = true }
    web    = { cpu = 512, memory = 1024, public = true }
    worker = { cpu = 1024, memory = 2048, public = false }
  }
}

module "service" {
  source   = "../../modules/ecs-service"
  for_each = local.services

  name             = each.key
  cpu              = each.value.cpu
  memory           = each.value.memory
  target_group_arn = try(aws_lb_target_group.app[each.key].arn, null)   # only public services have one
  cluster_arn      = aws_ecs_cluster.main.arn
  subnet_ids       = module.vpc.private_subnets
}
```
Everyday commands:
```bash
terraform init            # download providers and modules, configure the backend
terraform fmt -recursive  # canonical formatting
terraform validate        # syntax and type checks
terraform plan            # what would change
terraform apply           # only from CI for shared environments (lesson 03)
terraform output alb_dns
```

## Production patterns
- **Everything in code**, nothing created by hand in shared accounts.
- **Pinned versions** of Terraform and providers, with the lock file committed.
- **Small modules with validated inputs**, called with `for_each` from a map per environment.
- **Community modules for commodity infrastructure** (VPC, ALB), your own for app-specific pieces.
- **Clear ownership**: Terraform owns the platform; the deployment pipeline owns task definition revisions.

## Mistakes
Wrong: `count` over a list of names.
```hcl
resource "aws_ecr_repository" "repo" {
  count = length(var.names)        # removing the first name shifts every index: repositories get replaced
  name  = var.names[count.index]
}
```
Right: `for_each = toset(var.names)` with `each.key`.

Wrong: unpinned providers. A new major version arrives in the middle of a release. Right: `version = "~> 6.0"` plus `.terraform.lock.hcl` in git.

Wrong: a module that configures its own provider and region. It can't be reused in another account or region. Right: providers in the root module, passed implicitly or via `providers = { … }`.

Wrong: copy-pasting a service's configuration for a new service. Right: a module and one more entry in the map.

## Check yourself
1. What's the difference between a `resource` and a `data` source?
2. Why prefer `for_each` over `count` for named things?
3. What should a reusable module expose, and what should it leave to the caller?

<details>
<summary>Answers</summary>

1. A `resource` is something Terraform creates, updates, and destroys and tracks in state. A `data` source only reads something that already exists (an AMI, the current account ID, a hosted zone) without managing it.
2. `for_each` keys instances by a stable name, so adding or removing one item affects only that item. `count` keys by position, so removing an early item shifts the rest and Terraform replaces resources that didn't change.
3. Typed, validated inputs for what varies (name, size, subnets) and outputs for what callers need (IDs, ARNs, security group IDs). Provider configuration, credentials, and environment-specific decisions stay with the root module.
</details>

## Sources
- [Terraform — Configuration language](https://developer.hashicorp.com/terraform/language)
- [Terraform — Modules](https://developer.hashicorp.com/terraform/language/modules)
- [Terraform — The for_each meta-argument](https://developer.hashicorp.com/terraform/language/meta-arguments/for_each)
- [Terraform — Dependency lock file](https://developer.hashicorp.com/terraform/language/files/dependency-lock)
- [terraform-aws-modules](https://registry.terraform.io/namespaces/terraform-aws-modules)
