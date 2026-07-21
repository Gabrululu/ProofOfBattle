import { useEffect, useState } from "react";

export function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const duration = 2200;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(100, Math.round(((t - start) / duration) * 100));
      setProgress(p);
      if (p < 100) raf = requestAnimationFrame(tick);
      else setTimeout(() => setDone(true), 350);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (done) return null;

  const blocks = 12;
  const filled = Math.round((progress / 100) * blocks);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500"
      style={{ opacity: progress >= 100 ? 0 : 1 }}
      aria-hidden
    >
      {/* tether line + logo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="h-24 w-px bg-primary/70" />
        <div className="mt-2 font-mono text-primary text-2xl font-black tracking-tighter drop-shadow-[0_0_12px_rgba(255,45,74,0.8)]">
          ⌬PB
        </div>
      </div>

      <h1
        className="font-sans font-black uppercase text-center leading-[0.95] text-primary text-5xl md:text-7xl tracking-tight"
        style={{ textShadow: "0 0 24px rgba(255,45,74,0.65), 0 0 60px rgba(255,45,74,0.35)" }}
      >
        PROOF OF BATTLE<br />IS INITIALIZING
      </h1>

      {/* progress with corner brackets */}
      <div className="relative mt-10 w-[280px]">
        <CornerBrackets />
        <div className="flex gap-1 px-3 py-3 justify-center">
          {Array.from({ length: blocks }).map((_, i) => (
            <div
              key={i}
              className="h-4 w-4 transition-colors"
              style={{
                background: i < filled ? "var(--color-primary)" : "transparent",
                border: "1px solid var(--color-primary)",
                boxShadow: i < filled ? "0 0 8px rgba(255,45,74,0.7)" : "none",
              }}
            />
          ))}
        </div>
        <div className="mt-2 text-center font-mono text-xs text-primary">
          ▲ {progress}%
        </div>
      </div>

      <div className="absolute bottom-10 font-mono text-[11px] tracking-[0.3em] text-primary/80">
        BOOTING ARENA SYSTEMS…
      </div>
    </div>
  );
}

function CornerBrackets() {
  const c = "absolute h-3 w-3 border-primary";
  return (
    <>
      <span className={`${c} -top-1 -left-1 border-l border-t`} />
      <span className={`${c} -top-1 -right-1 border-r border-t`} />
      <span className={`${c} -bottom-1 -left-1 border-l border-b`} />
      <span className={`${c} -bottom-1 -right-1 border-r border-b`} />
    </>
  );
}
