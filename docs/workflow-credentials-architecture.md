# Architecture Record: Workflow Credential Resolution & Hydration

## Executive Summary
This document explains how n8n resolves mapped credentials internally, explicitly isolating the differences between dynamic "lazy" UI instantiation on the canvas, and strict "eager" validations happening via the CLI and backend REST API.

When deploying n8n architectures programmatically (e.g., CI/CD or template provisioning), developers often rely on the visual `id` key inside `credentials` nodes to establish permission constraints. This record clarifies why "dirty state" mismatches occurred and how the system safely normalizes them.

## The Architectural Gap

### 1. External Schema Generation
The n8n internal node runner explicitly requests a cryptographic `UUID` pointer linked directly to the database instance when verifying node constraints (e.g., executing a Supabase node requires `service_role` secrets unlocked against your team's Postgres `credential` registry). 

When passing standard `nodeCredentials` payloads in exported JSON files, n8n writes:
```json
"credentials": {
  "supabaseApi": {
    "id": "e7b99...",
    "name": "Production Service Role"
  }
}
```
However, in automated Infrastructure-as-code scenarios where UUIDs change per staging environment, pipelines aggressively inject the human-readable string directly:
```json
"credentials": {
  "supabaseApi": {
    "id": "Production Service Role"
  }
}
```

### 2. Vue Canvas vs Database Validation

**The Frontend Optimization (Lazy-Loading):**
Historically, mapping massive arrays of nodes into the canvas `NodeSettings` panel is computationally expensive. To ensure smooth 60fps scrolling, Vue's `workflows.store.ts` intentionally delayed database validation. It allowed literal localized strings disguised as ID variables to sit passively on the canvas. 
- *The consequence:* A user pasting automated JSON structurally bypassed the core UUID requirement. The global execution checker blindly read `id: 'Production Service Role'`, evaluated it as structurally invalid, and forced the classic "disappearing credentials" bug until a human manually hydrated it by opening the settings dropdown constraint.

**The Backend Friction (Strict Boundary):**
The `POST /workflows` REST API route enforces complete schema hydration via `replaceInvalidCredentials()`. While a fallback algorithm to query `name` instead of `uuid` existed, it operated under rigid contract assumption, crashing against automation scripts that omitted the `.name` parameter completely.

## Implemented Standardizations

To establish guaranteed pipeline compatibility moving forward:

1. **Eager Coalescing in API:**
   The backend logic located in `workflow-helpers.ts` introduces an Anti-Corruption Layer upon ingestion. All unresolvable `.id` strings natively fallback to executing a `nodeCredentials.name || nodeCredentials.id` database retrieval pattern. Human-readable titles perfectly hot-swap themselves onto robust unique internal UUIDs seamlessly.
   
2. **Eager Pre-Render Hydration:**
   The `workflows.store.ts` file now aggressively queries the local `Pinia` credential stores the precise millisecond nodes are dropped or loaded onto a canvas. Any string anomalies correctly identify their local counterparts via `.type` and `.name` matrix checking, immediately validating the JSON prior to rendering to unlock native **Save/Publish** availability without manual interaction.

## Process Failures & Lessons Learned

The legacy codebase hid a deeper architectural failure: an intentional backwards-compatibility measure that silently decayed without explicit schema versioning.

### 1. The Decay of Implicit Fallbacks
Early V1 workflows stored human-readable strings natively inside `cred.id`. When n8n migrated to proper UUIDs (V2+), a backwards-compatibility fallback was added: *"If UUID fails, assume it's a V1 payload and match the UUID against `cred.name`."* (`c.name === cred.id`). 

When modern V3 imports arrived carrying foreign UUIDs in `id` and the valid human name in `name`, this fallback literally asked: *"Does our local credential's name equal their machine's UUID?"* and failed quietly.
**Lesson:** Never use "duck typing" implicitly to waterfall through fallbacks on sensitive data contracts. Payloads should carry explicit schema versions (`v1`, `v2`) so decoders know whether `id` should be evaluated as a UUID or a string name. 

### 2. "Happy Path" Integration Blindspots
Automated UI tests verified that duplicating a node successfully brought over its credentials. Because it occurred on the same machine, the UUID instantly resolved, and the test passed. What failed to be structurally tested was the standard Environmental Migration: importing modern JSON from a *different* tenant.
**Lesson:** End-to-end integration tests must explicitly mock/sabotage primary identifiers (UUIDs) when executing cross-instance flows to prove that safety safety nets (like string-matched name fallbacks) actually catch edge cases correctly.
