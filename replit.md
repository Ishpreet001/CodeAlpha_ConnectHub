# ConnectHub

ConnectHub is a full-stack social platform for sharing updates, discovering people, and building community.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/connecthub run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, Replit App Storage variables, and `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/connecthub/src/` — frontend routes, components, and theme
- `artifacts/api-server/src/routes/connecthub.ts` — social API routes
- `artifacts/api-server/src/middlewares/auth.ts` — password hashing and session middleware
- `lib/db/src/schema/` — database source of truth
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- The frontend uses generated React Query hooks so API requests stay aligned with the OpenAPI contract.
- Sessions use opaque random cookies with only a SHA-256 hash persisted in PostgreSQL.
- Post images use direct App Storage uploads instead of sending file bytes through Express.
- The feed is intentionally lightweight: followed users plus the current user, with discovery kept separate.

## Product

Users can register, log in, publish text or image updates, like and comment, follow people, search profiles, edit their profile, and receive activity notifications.

## User preferences

The product should stay beginner-friendly and presentable for a college project while keeping major features functional rather than mocked.

## Gotchas

- Run API codegen after every OpenAPI change.
- Push the development database schema before starting the API server on a fresh environment.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
