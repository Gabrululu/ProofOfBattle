import { useEffect, useRef } from "react";

interface Props {
  lines: string[];
  audioBase64?: string;
}

export function Commentary({ lines, audioBase64 }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    if (!audioBase64) return;
    const blob = new Blob(
      [Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0))],
      { type: "audio/mpeg" }
    );
    const url = URL.createObjectURL(blob);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    }
    return () => URL.revokeObjectURL(url);
  }, [audioBase64]);

  return (
    <div className="relative border border-gray-800 rounded-lg overflow-hidden bg-[#08080f]">
      {/* TV header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 bg-black/40">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-blink" />
          <span className="text-[9px] font-black tracking-[0.3em] text-red-400">ON AIR</span>
        </span>
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-[9px] font-mono text-gray-600 tracking-widest">ELEVENLABS COMMENTARY</span>
      </div>

      {/* Lines */}
      <div className="h-32 overflow-y-auto px-3 py-2 flex flex-col gap-1 scrollbar-none">
        {lines.map((line, i) => (
          <p
            key={i}
            className={`text-sm leading-snug font-mono ${
              i === lines.length - 1
                ? "text-white animate-slide-up"
                : "text-gray-500"
            }`}
          >
            {line}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
