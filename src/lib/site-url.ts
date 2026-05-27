import { env } from "@/lib/env";

type RequestLike = {
  headers: Headers;
};

export const DEFAULT_SITE_URL = "https://optima-seller-ai-omega.vercel.app";

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

export function getSiteOriginClient() {
  if (env.NEXT_PUBLIC_SITE_URL) return normalizeOrigin(env.NEXT_PUBLIC_SITE_URL);
  const maybeWindow = (globalThis as unknown as { window?: { location?: { origin?: string } } }).window;
  if (maybeWindow?.location?.origin) return normalizeOrigin(maybeWindow.location.origin);
  return DEFAULT_SITE_URL;
}

export function getSiteOriginFromRequest(req: RequestLike) {
  // Prefer forwarded headers on Vercel/Proxies.
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.headers.get("x-forwarded-server");

  if (host) return normalizeOrigin(`${proto}://${host}`);
  if (env.NEXT_PUBLIC_SITE_URL) return normalizeOrigin(env.NEXT_PUBLIC_SITE_URL);
  return DEFAULT_SITE_URL;
}
