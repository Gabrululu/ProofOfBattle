// V1: external embed only (YouTube Live / Twitch) — the referee streams from
// their own phone/broadcast app and pastes the URL. A native camera broadcast
// from the Seeker mobile app (WebRTC) is a documented future item, not this.
function toEmbedUrl(raw: string): { kind: "youtube" | "twitch" | "link"; url: string } {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return { kind: "youtube", url: `https://www.youtube.com/embed/${u.pathname.slice(1)}` };
    }
    if (host.endsWith("youtube.com")) {
      const videoId = u.searchParams.get("v");
      if (videoId) return { kind: "youtube", url: `https://www.youtube.com/embed/${videoId}` };
      if (u.pathname.startsWith("/live/")) {
        return { kind: "youtube", url: `https://www.youtube.com/embed/${u.pathname.split("/")[2]}` };
      }
    }
    if (host.endsWith("twitch.tv")) {
      const channel = u.pathname.split("/").filter(Boolean)[0];
      if (channel) {
        const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
        return { kind: "twitch", url: `https://player.twitch.tv/?channel=${channel}&parent=${parent}` };
      }
    }
  } catch {
    /* not a valid URL — fall through to plain link */
  }
  return { kind: "link", url: raw };
}

export function LiveStream({ url }: { url: string }) {
  const embed = toEmbedUrl(url);

  if (embed.kind === "link") {
    return (
      <div className="aspect-video w-full rounded-xl border border-border bg-surface flex items-center justify-center">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-primary hover:underline"
        >
          Ver transmisión ↗
        </a>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden border border-border bg-black">
      <iframe
        src={embed.url}
        title="Live stream"
        className="w-full h-full"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
