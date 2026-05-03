# mino-landing-page

This repository contains the Mino landing page, packaged as a pnpm monorepo. The
deployable artifact is **`artifacts/mino`** — a Vite + React static site. The
other artifacts in `artifacts/` (API server, mockup sandbox) are part of the
broader project but are **not** what Vercel builds.

## Deploying to Vercel

The repo ships with a `vercel.json` that tells Vercel exactly how to build the
Mino landing page out of this monorepo. You should not need to change any
settings in the Vercel UI.

1. Go to https://vercel.com/new
2. Click **Import Git Repository** and select `mino-landing-page`
3. Leave every detected setting as-is (Framework Preset: *Other*, Root
   Directory: `./`, Build Command, Install Command, and Output Directory are
   all picked up from `vercel.json`)
4. Click **Deploy**

That's it — Vercel will:
- install the whole pnpm workspace at the repo root
- build only the `@workspace/mino` package and its workspace dependencies
- serve the static output from `artifacts/mino/dist/public`

### Adding your custom GoDaddy domain

Once the first deploy succeeds:

1. In the Vercel dashboard, open your new project
2. Go to **Settings → Domains**
3. Click **Add**, type your GoDaddy domain, and follow Vercel's instructions
   for either pointing your domain's nameservers at Vercel or adding the `A` /
   `CNAME` records in GoDaddy's DNS panel

## Local development (optional)

This repo is primarily authored on Replit. If you want to run the landing page
locally:

```bash
corepack enable
pnpm install
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/mino run dev
```

The dev server listens on `http://localhost:3000/`.
