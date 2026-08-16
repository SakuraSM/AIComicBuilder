# ADR-0002: Model credentials are server-owned

## Status

Accepted

## Context

The browser model store currently persists provider secrets and sends complete credentials with generation requests, allowing secrets to reach local storage and Task payloads.

## Decision

Clients select a server-owned model profile by identifier. Credentials are encrypted at rest using the deployment encryption key and are resolved only inside the Model Module. Compatibility requests containing legacy model configuration are executed synchronously and are never persisted to Tasks.

## Consequences

Settings require authenticated model-profile endpoints and a one-time legacy import path. Deployments must configure `MODEL_CONFIG_ENCRYPTION_KEY` before saving credentials.
