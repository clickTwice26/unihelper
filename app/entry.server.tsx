import { PassThrough } from "node:stream";
import { randomBytes } from "node:crypto";

import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import { env } from "~/lib/env.server";

export const streamTimeout = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext,
  // If you have middleware enabled:
  // loadContext: RouterContextProvider
) {
  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  const nonce = randomBytes(16).toString("base64");

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    let readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";

    // Abort the rendering stream after the `streamTimeout` so it has time to
    // flush down the rejected boundaries
    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => abort(),
      streamTimeout + 1000,
    );

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              // Clear the timeout to prevent retaining the closure and memory leak
              clearTimeout(timeoutId);
              timeoutId = undefined;
              callback();
            },
          });
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          // Avoid stale HTML while iterating locally. Vite already handles
          // asset invalidation, but disabling document caching in development
          // prevents confusing refresh-to-refresh mismatches.
          if (process.env.NODE_ENV !== "production") {
            responseHeaders.set("Cache-Control", "no-store");
          }

          // ── Security headers ────────────────────────────────────────────
          // Enforce HTTPS in production (1 year, include subdomains)
          if (process.env.NODE_ENV === "production") {
            responseHeaders.set(
              "Strict-Transport-Security",
              "max-age=31536000; includeSubDomains",
            );
          }
          // Prevent clickjacking
          responseHeaders.set("X-Frame-Options", "DENY");
          // Stop MIME-type sniffing
          responseHeaders.set("X-Content-Type-Options", "nosniff");
          // Limit referrer information to same-origin only
          responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
          // Disable browser features that are not needed
          responseHeaders.set(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=()",
          );
          // Content-Security-Policy — adjust `style-src` if you add more CDN assets
          responseHeaders.set(
            "Content-Security-Policy",
            [
              "default-src 'self'",
              // In production, Vite outputs external JS bundles — no inline scripts exist
              // except React Router's hydration script, which receives the nonce.
              // In development, Vite injects its own inline HMR scripts that have no nonce,
              // so we fall back to 'unsafe-inline' to avoid breaking the dev server.
              process.env.NODE_ENV === "production"
                ? `script-src 'self' 'nonce-${nonce}'`
                : "script-src 'self' 'unsafe-inline'",
              // Tailwind inlines style attributes; Google Fonts needs style-src
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              `img-src 'self' data: https://api.qrserver.com ${env.R2_PUBLIC_URL}`,
              `frame-src 'self' ${env.R2_PUBLIC_URL}`,
              "connect-src 'self' ws: wss:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          );

          pipe(body);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            import("~/lib/logger.server").then(({ logger }) =>
              logger.error({ err: error }, "Stream render error"),
            );
          }
        },
      },
    );
  });
}
