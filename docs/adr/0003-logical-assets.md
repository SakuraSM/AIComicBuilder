# ADR-0003: Workflows exchange logical asset references

## Status

Accepted

## Context

Upload routes support Local and S3 storage, while several provider and FFmpeg implementations still exchange physical paths.

## Decision

Workflow and model Interfaces exchange `AssetRef` values. The Asset Module owns persistence, materialization, public URL resolution, downloads, and temporary-file cleanup. Local and S3 are adapters at this seam.

## Consequences

S3 becomes a supported end-to-end deployment mode. Provider implementations no longer choose permanent storage locations.
