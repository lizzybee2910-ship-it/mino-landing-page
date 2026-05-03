import type { Plugin } from "vite";

/**
 * Dev-only Vite plugin that prevents Vite's HMR client from doing a full
 * page reload after a transient WebSocket disconnect.
 *
 * Why this exists:
 *   When the mino dev preview is rendered inside Replit's canvas iframe
 *   wrapper, the proxied HMR WebSocket is dropped frequently (within
 *   seconds). Vite's @vite/client handles the `vite:ws:disconnect` event
 *   by waiting for the server to ping back and then calling
 *   `location.reload()`, which the user sees as the page flickering /
 *   jumping every ~3 seconds.
 *
 *   We can't keep the WebSocket alive (no Vite knob for that, and the
 *   drop happens at the proxy layer outside the artifact). A previous
 *   attempt monkey-patched `window.location.reload` in the browser, but
 *   `Object.defineProperty(window.location, "reload", ...)` throws inside
 *   the canvas iframe (the property is non-configurable there). So
 *   instead we patch the dev-only `@vite/client` source itself: we
 *   intercept HTTP responses for `/@vite/client` and replace the single
 *   `location.reload()` call inside the `vite:ws:disconnect` handler
 *   with a console.debug. The two other `location.reload()` calls in the
 *   same module (HMR-circular-import recovery, first-update overlay) are
 *   left untouched because they reflect real changes the user made.
 *
 * Scope:
 *   - `apply: 'serve'` ensures this plugin is a no-op for `vite build`,
 *     so production builds are completely unaffected.
 *   - The patch only modifies the response body for the exact path
 *     `/@vite/client`. No app code is touched.
 *   - If the upstream Vite client source changes shape and the marker
 *     string we look for stops matching, we log a one-time warning to
 *     the dev server console so the regression is visible.
 */
export function canvasFlashFix(): Plugin {
  let warned = false;

  return {
    name: "mino:canvas-flash-fix",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        // Only intercept GET requests for /@vite/client (Vite optionally
        // appends a ?v=<hash> cache-busting query). HEAD, conditional GETs
        // with 304, etc. all flow through untouched.
        if (req.method !== "GET") return next();
        const url = req.url.split("?")[0];
        if (url !== "/@vite/client") return next();

        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);
        const chunks: Buffer[] = [];

        const toBuffer = (
          chunk: unknown,
          encoding?: BufferEncoding,
        ): Buffer | null => {
          if (chunk == null) return null;
          if (Buffer.isBuffer(chunk)) return chunk;
          if (typeof chunk === "string") {
            return Buffer.from(chunk, encoding ?? "utf8");
          }
          if (chunk instanceof Uint8Array) return Buffer.from(chunk);
          return null;
        };

        // Decide at end-time whether this response is one we should
        // patch. If the status isn't 2xx or the content-type isn't a
        // JS module, we just stream the buffered bytes through unmodified
        // -- we never want to corrupt 304/redirect/error responses.
        const shouldPatchResponse = (): boolean => {
          if (res.statusCode < 200 || res.statusCode >= 300) return false;
          const ct = res.getHeader("content-type");
          const ctStr = Array.isArray(ct) ? ct.join(",") : String(ct ?? "");
          return /javascript|ecmascript/i.test(ctStr);
        };

        // Buffer the response so we can search-and-replace the
        // disconnect-triggered reload before flushing to the client.
        res.write = ((
          chunk: unknown,
          encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
          maybeCb?: (err?: Error | null) => void,
        ) => {
          const encoding =
            typeof encodingOrCb === "string" ? encodingOrCb : undefined;
          const cb =
            typeof encodingOrCb === "function" ? encodingOrCb : maybeCb;
          const buf = toBuffer(chunk, encoding);
          if (buf) chunks.push(buf);
          // Resolve the callback on next tick so callers don't see
          // synchronous re-entrancy they wouldn't get from the real
          // Node response stream.
          if (cb) process.nextTick(cb);
          return true;
        }) as typeof res.write;

        res.end = ((
          chunkOrCb?: unknown,
          encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
          maybeCb?: (err?: Error | null) => void,
        ) => {
          let chunk: unknown = chunkOrCb;
          let encoding: BufferEncoding | undefined;
          let cb: ((err?: Error | null) => void) | undefined;
          if (typeof chunkOrCb === "function") {
            cb = chunkOrCb as (err?: Error | null) => void;
            chunk = undefined;
          } else if (typeof encodingOrCb === "string") {
            encoding = encodingOrCb;
            cb = maybeCb;
          } else if (typeof encodingOrCb === "function") {
            cb = encodingOrCb;
          }
          const buf = toBuffer(chunk, encoding);
          if (buf) chunks.push(buf);

          let body = Buffer.concat(chunks);
          if (shouldPatchResponse()) {
            const text = body.toString("utf8");
            const patched = patchViteClient(text);
            if (patched === text && !warned) {
              warned = true;
              server.config.logger.warn(
                "[mino:canvas-flash-fix] could not find the " +
                  "vite:ws:disconnect reload site in @vite/client. Vite " +
                  "may have changed its client source -- the canvas-iframe " +
                  "flash workaround is now a no-op. Update " +
                  "artifacts/mino/src/dev/canvas-flash-fix-plugin.ts.",
              );
            }
            body = Buffer.from(patched, "utf8");
          }
          // Recompute Content-Length only when the upstream actually set
          // it; otherwise we leave the response chunked / framework-managed.
          if (res.getHeader("content-length") !== undefined) {
            res.setHeader("content-length", body.byteLength);
          }
          // Hand the buffered (possibly patched) body to the real end()
          // and forward the caller's callback so the stream lifecycle
          // signals correctly.
          return originalEnd(body, cb);
        }) as typeof res.end;

        // The original write reference is captured so it can't be GC'd
        // while the request is in flight; its sole purpose is to stay
        // alive for the duration of this closure.
        void originalWrite;
        next();
      });
    },
  };
}

/**
 * Replace the `location.reload();` call inside @vite/client's
 * `vite:ws:disconnect` handler with a logged no-op. We anchor the match
 * on the surrounding code (the `waitForSuccessfulPing` call that
 * immediately precedes the reload) so we cannot accidentally rewrite the
 * other two reload sites in the same module.
 */
function patchViteClient(source: string): string {
  const marker = "await waitForSuccessfulPing(url.href);";
  const index = source.indexOf(marker);
  if (index === -1) return source;
  const after = source.slice(index + marker.length);
  const reloadCall = "location.reload();";
  const reloadIndex = after.indexOf(reloadCall);
  if (reloadIndex === -1 || reloadIndex > 200) return source;
  const replacement =
    'console.debug("[mino] suppressed Vite HMR reload after ws reconnect ' +
    '(canvas-iframe flash fix)");';
  return (
    source.slice(0, index + marker.length) +
    after.slice(0, reloadIndex) +
    replacement +
    after.slice(reloadIndex + reloadCall.length)
  );
}
