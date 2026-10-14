import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// CSP: Next.js App Router still needs 'unsafe-inline' for its bootstrap scripts
// and styles. Replace with per-request nonces once the UI shell lands (BACKLOG).
// 'unsafe-eval' is dev-only (React Refresh).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  ...(isDev
    ? []
    : [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Stop `next dev` from appending its managed block to the tracked AGENTS.md.
  agentRules: false,
  // pino uses worker threads for transports; keep it out of the server bundle.
  serverExternalPackages: ["pino", "pino-pretty"],
  // No CORS headers: the API is same-origin only and not meant for third-party callers.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
