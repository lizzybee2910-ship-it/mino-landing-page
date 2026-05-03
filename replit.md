# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/mino run test:e2e` — run Playwright responsive-overflow tests against the mino landing page (also wired as the `responsive-overflow` validation command)

## Testing

- **Mino responsive-overflow guard** (`artifacts/mino/tests/e2e/responsive-overflow.spec.ts`) — Playwright test that loads the landing page at 375 / 400 / 768 / 1280px widths, scrolls top-to-bottom, and asserts `documentElement.scrollWidth <= window.innerWidth`. Reports the worst offending elements when overflow is detected. Uses the system `chromium` binary (installed via Nix); falls back through `chromium`, `chromium-browser`, `google-chrome` on `PATH`. Override with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Spawns its own dev server on port 18936.
- **Automatic post-merge run** — `scripts/post-merge.sh` invokes `pnpm --filter @workspace/mino run test:e2e` after `pnpm install` / `db push`, so every merge runs the responsive-overflow guard. A failure aborts the post-merge script (`set -e`) and surfaces in the merge logs, blocking horizontal-overflow regressions from shipping. The post-merge timeout in `.replit` is set to 360 000 ms to comfortably fit the dev server boot plus the four-viewport sweep.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- `artifacts/api-server` — Express 5 API at `/api`. Routes: `GET /healthz`, `POST /waitlist`, the full auth suite (see Authentication below), and the `/api/learn/*` course catalog (see Learn Module).
- `artifacts/mino` — `(mino)` premium peptide & regenerative-medicine landing page (React + Vite). Editorial sage-cream-forest palette, Cormorant Garamond serif + Inter sans, parenthetical `(mino)` wordmark. Six landing sections (Promise, Protocols, Partners, Patients, Standard, Waitlist) plus hero, trust bar, and footer. Uses real brand assets from `attached_assets/` only — no AI-generated imagery. Also hosts the login-gated `/learn` member education library — see Learn Module below.
- `artifacts/mockup-sandbox` — design preview server (canvas).

## Authentication

The API implements two login paths:

### Replit OIDC (primary)
- `GET /api/login` — initiates PKCE authorization code flow
- `GET /api/callback` — exchanges code for tokens, upserts user, sets session cookie
- `GET /api/logout` — clears session and redirects through OIDC end-session URL

### Password auth (secondary)
- `POST /api/auth/register` — creates an unverified account; sends verification email via Resend if `RESEND_API_KEY` is set; returns `devVerificationToken` in non-production
- `POST /api/auth/verify-email` — consumes token, marks account verified, issues session
- `POST /api/auth/resend-verification` — issues a fresh token and resends the verification email (rate-limited; always 200 to avoid account enumeration)
- `POST /api/auth/password-login` — logs in a *verified* account (blocks unverified with 403)

### Recent security activity
- Successful sign-ins (password and OIDC, browser and mobile), password resets, and authenticated password changes are recorded as rows in `security_events` with the caller's IP and user agent (best-effort — failures are logged but never block the user-facing action).
- `GET /api/auth/security-events` returns the ten most recent events for the authenticated caller (newest first), powering the "Recent security activity" panel on `/account` so members can audit their account independent of the change-notification email.

### Security controls
- **Email verification gate** — new password accounts cannot log in until email ownership is confirmed
- **OIDC conflict resolution** — `upsertUser()` detects email collisions between password and OIDC accounts; unverified squatted accounts are taken over by the OIDC identity (sessions revoked, passwordHash cleared)
- **Startup backfill** — on server start, legacy rows with `emailVerified='false'` and no verification token are promoted to verified, preventing lockout of pre-existing accounts
- **Rate limiting** — `express-rate-limit` (20 req/15 min/IP) on all password auth routes; `trust proxy: 1` for real-IP extraction
- **CSRF protection** — `requireSameOrigin` middleware rejects cross-origin `Origin` headers; `requireJsonContentType` blocks form submissions; CORS restricted to `REPLIT_DEV_DOMAIN`

### Environment variables for auth
| Variable | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | Recommended (production) | Enables transactional email delivery via Resend for verification emails |
| `EMAIL_FROM` | Optional | From address for verification emails (default: `noreply@mino.app`) |
| `APP_ORIGIN` | Recommended (production) | Canonical public origin used in email verification links (e.g. `https://mino.app`). Falls back to request Host header when unset — set this explicitly in production to prevent host-header injection in email links |
| `ISSUER_URL` | Optional | OIDC issuer URL (default: `https://replit.com/oidc`) |

If `RESEND_API_KEY` is not set, registration still succeeds but verification emails are not delivered. In non-production the `devVerificationToken` field in the registration response can be used to complete verification manually.

## Database tables

- `waitlist_signups` — id (serial PK), name, email (unique), role (`provider | clinic_owner | partner | patient | other`), notes (nullable), created_at.
- `users` — id (varchar PK, UUID), email (unique), first_name, last_name, profile_image_url, password_hash (nullable), email_verified (varchar, 'true'/'false'), email_verification_token (SHA-256 hash, nullable), email_verification_token_expires_at (nullable), oidc_sub (nullable), created_at, updated_at.
- `sessions` — sid (PK), sess (jsonb), expire (timestamp).
- `security_events` — id (varchar PK, UUID), user_id (FK → users, cascade), event_type (`login_password|login_oidc|password_reset|password_changed`), ip_address (nullable), user_agent (nullable, truncated to 500 chars), created_at. Indexed on (user_id, created_at) for fast per-user audit queries. Surfaced via `GET /api/auth/security-events` on the account page.
- `learn_courses` — slug (PK), title, subtitle, description, audience, duration, category (`business|clinical|specialty`), icon, color, outcomes (jsonb string[]), position, created_at, updated_at.
- `learn_modules` — id (PK), course_slug (FK → courses), position, title, duration, objective. Cascades on course delete.
- `learn_lessons` — id (PK), module_id (FK → modules), course_slug (denormalised, FK → courses), slug (unique-per-course), title, duration, position, content_items (jsonb), quiz (jsonb, nullable). Cascades on module delete.
- `learn_enrollments` — (user_id, course_slug) composite PK, enrolled_at. All courses are free; enrollment is one-click and instant.
- `learn_lesson_progress` — (user_id, lesson_id) composite PK, completed (boolean), completed_at, quiz_score (nullable). Drives course progress percent.
- `learn_lesson_views` — (user_id, lesson_id) composite PK, course_slug (FK → courses), last_viewed_at. Records every time a member opens a lesson (independent of completion); upsert bumps `last_viewed_at`. Index on (user_id, last_viewed_at) powers the dashboard "Recently viewed" strip. **Retention**: bounded per user — `POST /api/learn/lessons/:id/view` upserts then trims the row down to that user's 50 most-recent lessons (`VIEW_HISTORY_RETAIN_PER_USER` in `artifacts/api-server/src/routes/learn.ts`), keeping the dashboard join (`GET /api/learn/me`, which still returns just the most-recent ~5) fast and preventing unbounded long-term growth. The dashboard query itself is unchanged — the cap simply caps how far back history can grow.
- `learn_course_handouts` — id (PK, e.g. `${courseSlug}__h1`), course_slug (FK → courses), position, title, description, body (text: blank-line-delimited paragraphs, `- ` prefix for bullets), updated_at. Cascades on course delete.

## Learn Module

The `/learn` library is a private, login-gated education area on the Mino site. Stripe was intentionally dropped — every course is free, with one-click enrollment.

### Routes (Mino)
- `/login`, `/signup`, `/verify-email` — public auth pages (custom Replit-style password auth, dev verification token surfaced inline outside production).
- `/learn` — catalog of all courses, filterable by category (`Business | Clinical | Specialty`). Each card shows duration, lesson count, audience, and per-user enrollment/progress state.
- `/learn/:courseSlug` — course detail with outcomes, full module/lesson outline, and an "Enroll for free" CTA when not yet enrolled. Once enrolled, lesson links unlock and a progress bar appears.
- `/learn/:courseSlug/:lessonSlug` — lesson view with body content (bulleted points), optional quiz, prev/next navigation, and a Mark complete / Completed toggle.

All `/learn/*` routes are wrapped by `<RequireAuth>` (`artifacts/mino/src/components/require-auth.tsx`), which redirects unauthenticated visitors to `/login?next=<original-path>` and renders a quiet placeholder while the session resolves.

### API endpoints (api-server, behind `requireAuth`)
- `GET /api/learn/courses` — catalog with per-user enrollment + progress (`{ courses: LearnCatalogCourse[] }`).
- `GET /api/learn/courses/:slug` — course detail with module → lesson outline and aggregate progress.
- `POST /api/learn/courses/:slug/enroll` — idempotent enrollment.
- `GET /api/learn/courses/:slug/lessons/:lessonSlug` — lesson body. Returns `403 { error: "Enroll in this course to access lessons." }` when no enrollment exists; the lesson page catches this and bounces back to the course page.
- `POST /api/learn/lessons/:id/complete` — marks lesson complete (optionally records `quizScore`).
- `DELETE /api/learn/lessons/:id/complete` — un-marks lesson.
- `POST /api/learn/lessons/:id/view` — records that the caller opened a lesson (independent of completion). Idempotent upsert into `learn_lesson_views`; requires enrollment. Fired automatically on mount of `/learn/:courseSlug/:lessonSlug`. Dashboard reads back the last 5 via `recentLessons` on `GET /api/learn/me`.
- `GET /api/learn/courses/:slug/certificate` — branded completion certificate PDF (auth + enrolled + 100% complete). Filename `mino-certificate-{slug}.pdf`. Certificate ID is a deterministic hash of `userId:slug` so re-downloads stay stable.
- `GET /api/learn/courses/:slug/handouts/:handoutId` — per-course handout PDF (auth + enrolled, OR caller is admin). Course detail payload also includes a `handouts[]` summary array (id, title, description) so the UI can render the list without a second round-trip.

### Admin handout authoring
- `users.is_admin` (boolean, default false) controls who can edit handouts. Set manually via SQL today; no self-serve admin promotion UI.
- Admin endpoints live under `/api/learn/admin/*` on a sub-router gated by `requireAdmin` (`artifacts/api-server/src/middlewares/requireAdmin.ts`):
  - `GET /api/learn/admin/status` — open to any signed-in user, returns `{isAdmin}` so the UI can decide whether to surface admin links.
  - `GET /api/learn/admin/courses` — slug + title list for the admin picker.
  - `GET /api/learn/admin/courses/:slug/handouts` — full handout list for editing.
  - `POST /api/learn/admin/courses/:slug/handouts` — create a new admin handout (auto-appended to the end). Stamps `is_authored = true`.
  - `PATCH /api/learn/admin/courses/:slug/handouts/:handoutId` — edit title/description/body. Editing an importer-owned row flips `is_authored` to true so the importer leaves it alone going forward.
  - `DELETE /api/learn/admin/courses/:slug/handouts/:handoutId` — remove a handout.
  - `POST /api/learn/admin/courses/:slug/handouts/reorder` — accepts `{ ids: string[] }` and reassigns 1..N positions inside a transaction (negative-position pre-pass to escape the unique index).
- Frontend editor: `/learn/:courseSlug/admin/handouts` (`artifacts/mino/src/pages/learn-course-admin-handouts.tsx`). Linked from the course detail page via the "Manage handouts" link, only rendered when `useAdminStatus()` returns `isAdmin`.
- `learn_course_handouts.is_authored` (boolean, default false) is the source of truth for ownership. Importer only deletes/re-inserts the auto handout id `${courseSlug}__h1` when its row has `is_authored = false`, and uses the next free position so admin handouts retain their slots.

### Certificates & handouts
- PDFs are generated by a hand-rolled writer (`artifacts/api-server/src/lib/pdf.ts`) supporting Helvetica regular/bold/italic (WinAnsi) for ASCII/Latin-1 text, with automatic per-codepoint fallback through a chain of embedded Noto Sans subsets covering Latin-extended/Greek/Cyrillic/Vietnamese (`NotoSans-{Regular,Bold}.ttf`), Simplified Chinese plus shared CJK Han glyphs (`NotoSansSC-Regular.ttf`), Arabic (`NotoSansArabic-Regular.ttf`), Devanagari for Hindi/Marathi/Sanskrit (`NotoSansDevanagari-Regular.ttf`), and Hebrew (`NotoSansHebrew-Regular.ttf`) — so member names in those scripts render their actual glyphs. Complex-script runs (Arabic joining forms, Devanagari conjuncts, Hebrew with marks) are passed through HarfBuzz (`harfbuzzjs`) for full GSUB *and* GPOS shaping before emission. GSUB substitutions paint joined and ligated forms (rather than disconnected isolated glyphs); GPOS positioning is honoured by a custom emitter that converts HarfBuzz's per-glyph `(ax, ay)` advances and `(dx, dy)` offsets into PDF text-showing operators: x-axis kerning lands inside `[…] TJ` array spacing deltas, while non-zero y-offsets (Arabic tashkil, Hebrew niqqud, Devanagari nukta) emit explicit `Td` translations between glyphs to descend onto / climb back from the mark anchor. The HarfBuzz wasm runtime is loaded once per process via top-level await using `createRequire` (the package's CJS entry is `module.exports = new Promise(...)`, which Vitest's ESM interop mishandles otherwise) and exposed through a typed `HbBindings` / `HbFont` / `HbBuffer` wrapper (no `any`). Each fallback face is embedded only when actually used, as a Type0 / Identity-H font with a CIDFontType2 descendant, a subset FontFile2 stream (`artifacts/api-server/src/lib/ttf.ts` parses + subsets the TTF, expanding composite glyphs), and a ToUnicode CMap. The CMap is built from a per-cluster cmap-inverse distribution: each shaped glyph in a cluster claims any source codepoint whose forward cmap entry resolves to that gid (so reused mark gids — e.g. the FATHA glyph appearing in three different clusters — get one stable `bfchar` mapping to U+064E, instead of overwriting each other), and the leftover cps fall through to the cluster's first unmatched glyph (so ligatures and Arabic positional base forms still recover their full source range). Round-tripping is verified end-to-end with `pdftotext`. High-level renderers live in `artifacts/api-server/src/lib/learn-pdf.ts`. Pure-ASCII certificates skip the fallback fonts entirely. The Simplified Chinese font is pre-subset to BMP CJK Unified Ideographs (~22k glyphs, 7.2MB) so it covers virtually all modern Chinese names without shipping the full multi-MB CJK family.
- Certificates are landscape Letter with the `(mino)` wordmark, an auto-sized member name, completion date, and footer certificate ID. Handouts are portrait Letter with paragraph + bullet support.
- A course can have multiple handouts (rendered in `position` order). The importer seeds at most one auto-generated "Quick reference" handout per course (id `${courseSlug}__h1`) derived from outcomes + module recap and is idempotent against admin-authored siblings.

### Importer
- `scripts/src/seed-data-courses.ts` — verbatim copy of the 10 courses ported from the Lovable `peptide-palooza-sales` repo (1 module → 1 lesson per source module).
- `scripts/src/import-courses.ts` — idempotent importer. Run with `pnpm --filter @workspace/scripts run import-courses`. Upserts courses and rebuilds modules + lessons each run (cascade-clean), so editing the seed file and re-running is safe.
