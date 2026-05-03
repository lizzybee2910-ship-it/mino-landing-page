#!/bin/bash
set -e

pnpm install --frozen-lockfile
pnpm --filter db push

echo "[post-merge] Running workspace typecheck..."
pnpm run typecheck
echo "[post-merge] Typecheck passed."

echo "[post-merge] Building production artifacts..."
pnpm --filter @workspace/api-server run build
PORT=18935 BASE_PATH=/ pnpm --filter @workspace/mino run build
PORT=8081 BASE_PATH=/__mockup pnpm --filter @workspace/mockup-sandbox run build
echo "[post-merge] Builds passed."

echo "[post-merge] Running api-server integration tests..."
pnpm --filter @workspace/api-server run test
echo "[post-merge] api-server integration tests passed."

echo "[post-merge] Running mino end-to-end tests..."
pnpm --filter @workspace/mino run test:e2e
echo "[post-merge] mino end-to-end tests passed."
