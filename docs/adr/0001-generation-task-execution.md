# ADR-0001: Generation tasks use leased asynchronous execution

## Status

Accepted

## Context

Generation logic is currently split between a large HTTP route and worker handlers. The existing worker can leave tasks permanently running after a process exit and cannot cancel or report durable progress.

## Decision

Long-running image, video, and assembly work executes through the Task Module. HTTP and worker processes are adapters at the same workflow seam. Tasks use idempotency keys, renewable leases, retry backoff, durable progress, cancellation requests, and standard error codes. Streaming text generation may remain request-scoped where immediate token delivery is the product requirement.

## Consequences

Deployments can recover interrupted work and callers use one small Interface. The Task table and worker lifecycle become load-bearing infrastructure and require PostgreSQL integration tests.
