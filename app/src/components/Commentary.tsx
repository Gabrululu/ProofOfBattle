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
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 h-40 overflow-y-auto">
      <p className="text-xs uppercase tracking-widest text-yellow-400 mb-2 font-bold">
        🎙 ElevenLabs Commentary
      </p>
      {lines.map((line, i) => (
        <p key={i} className="text-sm text-gray-200 leading-relaxed">
          {line}
        </p>
      ))}
      <div ref={bottomRef} />
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
