---
title: Background Jobs & Messaging cheatsheet
tech: BackgroundService, Channels, Hangfire, Azure Service Bus
version: .NET 10, Hangfire 1.8.x (Hangfire.SqlServer 1.8.25), Azure.Messaging.ServiceBus 7.x
date: 2026-11-09
covers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
---
# Background Jobs & Messaging cheatsheet
[← Overview](00-overview.md) · Reminder tables: what exists and what it is called. ⭐ = must know.

## Choosing a mechanism
| Mechanism | Durable | Use |
|:--|:--|:--|
| `Task.Run` in request | ✗ | never for real work |
| `BackgroundService` + `Channel<T>` | ✗ | losable in-process work |
| polling DB table | ✓ | outbox, simple queues |
| ⭐ Hangfire | ✓ | jobs, retries, schedules |
| ⭐ Service Bus | ✓ | messages between services |

## BackgroundService and Channels
| Item | Does | Note |
|:--|:--|:--|
| ⭐ `BackgroundService.ExecuteAsync(stoppingToken)` | worker loop | |
| `PeriodicTimer` | tick loop | |
| ⭐ `IServiceScopeFactory.CreateAsyncScope()` | scope per item | DbContext |
| ⭐ `Channel.CreateBounded<T>(n)` | backpressured queue | `FullMode` |
| `ReadAllAsync(ct)` | consume | `await foreach` |
| `HostOptions.ShutdownTimeout` | stop budget | |
| catch per item | keep loop alive | |

## Hangfire setup
| API | Does | Note |
|:--|:--|:--|
| ⭐ `AddHangfire(c => c.UseSqlServerStorage(cs))` | storage | schema `HangFire` |
| `SetDataCompatibilityLevel(Version_180)` | 1.8 format | |
| `UseRecommendedSerializerSettings()` | JSON settings | |
| ⭐ `AddHangfireServer(o => o.Queues = [...])` | workers | queue order = priority |
| `WorkerCount` | concurrency | |
| ⭐ `MapHangfireDashboard(path, new() { Authorization = [] }).RequireAuthorization(...)` | secure dashboard | |
| dedicated worker containers | scale separately | |

## Hangfire jobs
| API | Does | Note |
|:--|:--|:--|
| ⭐ `Enqueue<T>(x => x.M(id, CancellationToken.None))` | fire-and-forget | IDs as args |
| ⭐ `Schedule<T>(…, TimeSpan)` | delayed | |
| ⭐ `IRecurringJobManager.AddOrUpdate<T>("id", …, cron, options)` | recurring | stable IDs |
| `RecurringJobOptions.TimeZone` | local schedules | IANA IDs |
| `RemoveIfExists("id")` | delete recurring | |
| `ContinueJobWith<T>(parentId, …)` | continuation | |
| batches | Pro (commercial) | |
| `Cron.Daily(4)` / `"0 4 * * *"` | schedules | |
| `CancellationToken` param | shutdown/deletion token | |

## Retries and attributes
| Attribute | Does | Note |
|:--|:--|:--|
| ⭐ `[AutomaticRetry(Attempts = n)]` | retries | default 10 |
| `OnAttemptsExceeded = Fail / Delete` | after last | |
| `[Queue("critical")]` | queue | |
| `[DisableConcurrentExecution(timeout)]` | one at a time | distributed lock |
| `[JobDisplayName("…")]` | dashboard name | |
| permanent errors | finish/fail, no retry | |

## Idempotency
| Technique | Example | Note |
|:--|:--|:--|
| ⭐ check state first | `if (sentAt != null) return;` | |
| ⭐ unique constraints | `ProcessedMessages(MessageId, Handler)` | inbox |
| conditional update | `WHERE Status = 'Paid'` | |
| ⭐ provider idempotency keys | Stripe `IdempotencyKey` | |
| stable message IDs | outbox id = `MessageId` | |
| at-least-once | always assume | |

## Concurrency and priorities
| Need | Tool | Note |
|:--|:--|:--|
| priorities | queues | |
| cap concurrency | `WorkerCount`, `MaxConcurrentCalls` | |
| one at a time per type | `DisableConcurrentExecution` | |
| one at a time per entity | sessions / row locks | |
| outgoing rate limits | shared `RateLimiter` / Redis | |
| scale by backlog | KEDA in Container Apps | |

## Failures
| Practice | How | Note |
|:--|:--|:--|
| ⭐ classify | transient / permanent / poison | |
| Failed jobs / DLQ | holding area | |
| ⭐ alerts | failed > 0 (critical), failure rate | |
| replay | requeue / resubmit after fix | not blindly |
| context | job ID, attempt, trace ID | no secrets |

## Outbox
| Item | Does | Note |
|:--|:--|:--|
| ⭐ dual-write problem | DB + broker can diverge | |
| ⭐ outbox row in same transaction | atomic | |
| `SaveChangesInterceptor` | domain events → outbox | |
| publisher `BackgroundService` | send + mark | |
| `UPDLOCK, READPAST, ROWLOCK` | safe multi-replica claims | |
| `MessageId = outbox Id` | duplicate detection | |
| inbox table | consumer dedupe | |
| lag metric | oldest unprocessed | alert |
| cleanup job | delete old processed rows | |

## Service Bus
| Item | Does | Note |
|:--|:--|:--|
| ⭐ queue | competing consumers | commands |
| ⭐ topic + subscriptions | pub/sub with filters | events |
| ⭐ DLQ | poison/expired | per entity |
| peek-lock | Complete / Abandon / DeadLetter / Defer | |
| `MaxDeliveryCount` | retries before DLQ | default 10 |
| ⭐ duplicate detection | same `MessageId` dropped | window |
| ⭐ sessions | ordered per `SessionId` | |
| scheduled messages | `ScheduledEnqueueTime` | |
| `ServiceBusClient` singleton | one per app | `DefaultAzureCredential` |
| `ServiceBusProcessor` | consumer | `AutoCompleteMessages = false` |
| `AddAzureClients(...)` | DI registration | Microsoft.Extensions.Azure |
| emulator | local Docker | `UseDevelopmentEmulator=true` |
| roles | Data Sender / Data Receiver | managed identity |

## Other messaging options
| Option | Use | Note |
|:--|:--|:--|
| Event Grid | push events, resource events | |
| Event Hubs | streaming/telemetry | Kafka-compatible |
| Storage Queues | simple queue | |
| Redis pub/sub/streams | ephemeral | not business messages |
| Kafka | event platforms | |

## Libraries
| Library | Licence | Note |
|:--|:--|:--|
| ⭐ Azure.Messaging.ServiceBus | MIT | this stack |
| MassTransit 9 | commercial | v8 OSS |
| NServiceBus | commercial | |
| Wolverine | MIT | outbox built in |
| Rebus / Brighter | MIT | |
| Hangfire core | LGPL-3.0 | Pro commercial |

## Monitoring
| Signal | Alert | Note |
|:--|:--|:--|
| ⭐ queue depth | growing | |
| ⭐ oldest age | > SLO | |
| ⭐ DLQ / failed | > 0 critical | |
| failure rate | spike | |
| outbox lag | > 1 min | |
| traces | producer → consumer | `traceparent` property |

## Gotchas
| Gotcha | Why it bites | Do instead |
|:--|:--|:--|
| `Task.Run` fire-and-forget | lost work | durable queue |
| scoped services in singleton workers | disposed contexts | scope per item |
| entities as job args | stale, huge | IDs |
| assuming exactly-once | duplicates | idempotency |
| publish after commit | lost events | outbox |
| auto-complete + swallow | silent loss | explicit complete |
| no DLQ alerts | invisible failures | alert |
| unauthenticated dashboard | data exposure | admin policy |
| UTC cron for local tasks | wrong time | TimeZone option |
| Redis pub/sub for orders | not durable | Service Bus |

## Sources
| Source | Link |
|:--|:--|
| Hosted services | https://learn.microsoft.com/aspnet/core/fundamentals/host/hosted-services |
| Channels | https://learn.microsoft.com/dotnet/core/extensions/channels |
| Hangfire docs | https://docs.hangfire.io/ |
| Service Bus overview | https://learn.microsoft.com/azure/service-bus-messaging/service-bus-messaging-overview |
| Service Bus .NET SDK | https://learn.microsoft.com/dotnet/api/overview/azure/messaging.servicebus-readme |
| Duplicate detection | https://learn.microsoft.com/azure/service-bus-messaging/duplicate-detection |
| Transactional outbox | https://microservices.io/patterns/data/transactional-outbox.html |
| Compare messaging services | https://learn.microsoft.com/azure/service-bus-messaging/compare-messaging-services |
