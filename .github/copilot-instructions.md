# GitHub Copilot Instructions for n8n

Full project documentation: see [AGENTS.md](../AGENTS.md).

---

## TypeScript

- **Never `any`** — use `unknown` or a proper type
- **No `as` casts** outside of test code — use type guards/predicates
- Shared FE/BE types go in `packages/@n8n/api-types`
- Lazy-load heavy modules with `await import()` at point of use

## Error Handling

```typescript
// Use these — ApplicationError is deprecated
import { UnexpectedError, OperationalError, UserError } from 'n8n-workflow';
throw new UserError('Helpful message for the user');
```

## Frontend

- Vue 3 Composition API (`<script setup lang="ts">`)
- All UI text via i18n — add strings to `packages/@n8n/i18n`
- CSS variables only — never hardcode `px` values
- `data-testid` must be a single value (no spaces)
- Pure Vue components → `@n8n/design-system`

## Backend

- Controller → Service → Repository pattern
- Dependency injection via `@n8n/di`
- Config via `@n8n/config`
- Zod for validation at system boundaries

## Testing

- Jest (unit/integration) + Playwright (E2E)
- Always work from the package directory: `pushd packages/cli && pnpm test`
- Mock all external dependencies
- Run `pnpm typecheck` before committing

## Commands

```bash
pnpm build > build.log 2>&1   # always redirect; check tail -n 20 build.log
pnpm typecheck                 # required before commit
pnpm lint                      # required before commit
pnpm test <file>               # run from inside the package directory
```

## Key Packages

| Package | Purpose |
|---------|---------|
| `packages/cli` | Express server, REST API |
| `packages/editor-ui` | Vue 3 frontend |
| `packages/workflow` | Core types and interfaces |
| `packages/core` | Execution engine |
| `packages/nodes-base` | Built-in integrations |
| `packages/@n8n/api-types` | Shared FE/BE interfaces |
| `packages/@n8n/i18n` | UI translations |
