// Central source of truth for the bridge's base URL. VITE_BRIDGE_URL is
// meant to include a ws(s):// scheme (see .env.example), but a misconfigured
// deploy (e.g. the value pasted without a scheme in Vercel's dashboard) makes
// `new WebSocket(...)` and `fetch(...)` resolve it as a path relative to the
// current page instead of an absolute URL. Normalize defensively so a missing
// scheme doesn't silently break every request in production.
function toHttp(wsUrl: string): string {
  return wsUrl.replace(/^wss?/, (p) => (p === "wss" ? "https" : "http"));
}

function normalize(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^https?/i, (p) => (p.toLowerCase() === "https" ? "wss" : "ws"));
  }
  // No scheme at all — infer ws/wss from how this page was loaded so we
  // don't attempt an insecure ws:// call from an https:// page (mixed content).
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  return `${secure ? "wss" : "ws"}://${trimmed.replace(/^\/+/, "")}`;
}

const RAW = import.meta.env.VITE_BRIDGE_URL ?? "ws://localhost:8000";

export const BRIDGE_WS_URL = normalize(RAW);
export const BRIDGE_HTTP_URL = toHttp(BRIDGE_WS_URL);
