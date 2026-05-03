# Threat Model

## Project Overview

Mino is a pnpm-monorepo TypeScript application for a regenerative medicine and peptide-therapy platform. The production deployment consists of a React + Vite marketing/member frontend in `artifacts/mino`, an Express 5 API in `artifacts/api-server`, and a shared PostgreSQL/Drizzle data layer in `lib/db`. Authentication supports both Replit OIDC and email/password sessions. Production traffic is assumed to be served behind Replit-managed TLS, and `NODE_ENV=production` is assumed in deployed environments.

## Assets

- **User accounts and sessions** — browser session cookies, mobile bearer session IDs, password hashes, and OIDC-derived session state. Compromise enables impersonation.
- **Waitlist and lead data** — names, email addresses, role selections, freeform notes, and timestamps in `waitlist_signups`. This is business-sensitive contact data and may reveal healthcare-related interest.
- **OIDC tokens and refresh state** — access tokens and refresh tokens stored in the `sessions` table for Replit-authenticated users. Leakage would permit continued account access.
- **Application secrets and infrastructure credentials** — `DATABASE_URL`, `REPL_ID`, and any deployment configuration used to connect to Postgres and the OIDC provider.
- **Operational logs** — request metadata and server-side error logs. These must not expose session material or unnecessary PII.

## Trust Boundaries

- **Browser/mobile client to API** — all request bodies, query params, headers, and redirect targets are untrusted until validated server-side.
- **API to PostgreSQL** — the API has direct write access to user/session/waitlist tables. Injection or authorization failures here expose or modify all stored data.
- **API to Replit OIDC provider** — login, callback, logout, and refresh flows cross a third-party identity boundary and depend on correct redirect/origin handling.
- **Public to authenticated surface** — the landing page and waitlist submission are public; auth/session endpoints and any account-aware UI are sensitive and must enforce server-side guarantees.
- **Production to dev-only boundary** — `artifacts/mockup-sandbox`, generated `dist/` assets, and `.agents/` helper code are not treated as production-reachable unless a concrete runtime path proves otherwise.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/mino/src/main.tsx`
- **Highest-risk server files**: `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/middlewares/authMiddleware.ts`, `artifacts/api-server/src/lib/auth.ts`, `artifacts/api-server/src/routes/waitlist.ts`
- **Data-layer anchors**: `lib/db/src/schema/auth.ts`, `lib/db/src/schema/waitlist.ts`, `lib/db/src/index.ts`
- **Public surfaces**: `POST /api/waitlist`, `GET /api/healthz`, browser login/logout endpoints
- **Authenticated/mobile surfaces**: `GET /api/auth/user`, `POST /api/auth/password-login`, `POST /api/auth/register`, `POST /api/mobile-auth/token-exchange`, `POST /api/mobile-auth/logout`
- **Usually ignore unless reachability changes**: `artifacts/mockup-sandbox/**`, `.agents/**`, build artifacts under `dist/**`

## Threat Categories

### Spoofing

The application issues long-lived browser and mobile sessions and supports both password and OIDC login. Every authenticated request must derive identity only from a valid server-stored session, password login must resist brute-force attempts, and OIDC flows must bind callbacks to trusted origins and expected state. Email-address identities must not be claimable by arbitrary callers before mailbox ownership is proven, especially because password and OIDC users share one global email namespace.

### Tampering

All client input is untrusted, especially waitlist submissions, auth payloads, headers used to construct login/logout redirects, and mobile token-exchange parameters. The server must validate input shape and length, calculate sensitive state transitions server-side, and ensure user-controlled headers or parameters cannot alter authentication flow destinations or stored data outside intended records.

### Information Disclosure

The application stores business and potentially sensitive healthcare-adjacent interest data in waitlist signups and exposes account state through auth endpoints. API responses, duplicate checks, and logs must not reveal whether a third party has an account or is on the waitlist beyond what the requester is authorized to learn. Session cookies, bearer session IDs, OIDC tokens, and secrets must never appear in client-visible responses or logs.

### Denial of Service

Public endpoints include waitlist signup and password-based authentication. These endpoints must resist automated abuse through appropriate rate limiting, bounded request sizes, and safe error handling so an unauthenticated attacker cannot cheaply flood the database, brute-force credentials, or create excessive auth-provider traffic.

### Elevation of Privilege

The API currently has a small authenticated surface, but any session confusion, bearer-token misuse, or injection flaw would immediately cross from public access to authenticated user identity. Session IDs must remain unguessable, database access must stay parameterized/ORM-backed, and future member-only routes must continue enforcing authorization on the server rather than relying on frontend state.
