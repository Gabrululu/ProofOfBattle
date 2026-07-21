/**
 * Sazabi-style red border frame around the viewport.
 * Sits fixed above content but lets clicks through.
 */
export function PageFrame() {
  const edge =
    "fixed pointer-events-none z-[60] bg-gradient-to-r from-primary via-[color:var(--color-primary-deep)] to-primary shadow-[0_0_18px_rgba(255,45,74,0.55)]";
  return (
    <>
      {/* top + bottom bars */}
      <div className={`${edge} top-0 left-0 right-0 h-[3px]`} />
      <div className={`${edge} bottom-0 left-0 right-0 h-[3px]`} />
      {/* left + right bars */}
      <div className="fixed pointer-events-none z-[60] top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-primary via-[color:var(--color-primary-deep)] to-primary shadow-[0_0_18px_rgba(255,45,74,0.55)]" />
      <div className="fixed pointer-events-none z-[60] top-0 bottom-0 right-0 w-[3px] bg-gradient-to-b from-primary via-[color:var(--color-primary-deep)] to-primary shadow-[0_0_18px_rgba(255,45,74,0.55)]" />

      {/* corner ticks (inner) */}
      <Corner className="top-2 left-2 border-l border-t" />
      <Corner className="top-2 right-2 border-r border-t" />
      <Corner className="bottom-2 left-2 border-l border-b" />
      <Corner className="bottom-2 right-2 border-r border-b" />

    </>
  );
}

function Corner({ className }: { className: string }) {
  return (
    <span
      className={`fixed pointer-events-none z-[61] h-5 w-5 border-primary ${className}`}
      style={{ boxShadow: "0 0 10px rgba(255,45,74,0.6)" }}
    />
  );
}
