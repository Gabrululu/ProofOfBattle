import { useEffect, useRef, useState } from "react";

interface Props {
  hp: number;
  label: string;
  side: "a" | "b";
  flip?: boolean;
}

const SEGMENTS = 10;

export function HealthBar({ hp, label, side, flip = false }: Props) {
  const pct = Math.max(0, Math.min(100, hp));
  const filled = Math.ceil((pct / 100) * SEGMENTS);
  const isDanger = pct <= 25;
  const isWarning = pct > 25 && pct <= 50;
  const prevHp = useRef(hp);
  const [shaking, setShaking] = useState(false);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (hp < prevHp.current) {
      setShaking(true);
      setFlashing(true);
      setTimeout(() => setShaking(false), 450);
      setTimeout(() => setFlashing(false), 350);
    }
    prevHp.current = hp;
  }, [hp]);

  const blue = side === "a";
  const accentColor = blue ? "var(--color-secondary)" : "var(--color-primary)";
  const segColor = isDanger
    ? "var(--color-primary)"
    : isWarning
    ? "#ca8a04"
    : blue
    ? "var(--color-secondary-deep)"
    : "var(--color-primary)";
  const glowClass = blue ? "animate-glow-blue" : "animate-glow-red";
  const textGlow = blue ? "text-glow-blue" : "text-glow-red";

  return (
    <div className={`flex flex-col gap-1.5 w-full ${shaking ? "animate-shake" : ""}`}>
      {/* Label row */}
      <div className={`flex items-center justify-between ${flip ? "flex-row-reverse" : ""}`}>
        <span
          className={`text-[9px] tracking-[0.25em] uppercase font-black ${textGlow}`}
          style={{ color: accentColor }}
        >
          {label}
        </span>
        <span
          className={`text-2xl font-black tabular-nums leading-none ${isDanger ? "text-red-400 animate-pulse" : "text-white"}`}
        >
          {hp}
          <span className="text-[9px] font-normal text-muted ml-0.5">HP</span>
        </span>
      </div>

      {/* Segmented bar */}
      <div
        className={`relative flex h-5 gap-px overflow-hidden rounded-sm border ${glowClass}`}
        style={{
          borderColor: `${accentColor}55`,
          flexDirection: flip ? "row-reverse" : "row",
        }}
      >
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const active = flip ? i < filled : i < filled;
          return (
            <div
              key={i}
              className="flex-1 transition-all duration-300"
              style={{
                backgroundColor: active ? segColor : "#111827",
                opacity: active ? 1 : 0.4,
              }}
            />
          );
        })}

        {/* Impact flash overlay */}
        {flashing && (
          <div
            className="absolute inset-0 animate-impact-flash"
            style={{ backgroundColor: accentColor }}
          />
        )}

        {/* Scanline shimmer on active bar */}
        <div
          className="absolute inset-y-0 w-px bg-white/20 pointer-events-none"
          style={{ left: `${pct}%`, transition: "left 300ms" }}
        />
      </div>
    </div>
  );
}
