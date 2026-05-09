import { useEffect, useRef } from "react";

interface RobotPos { x: number; y: number; }
interface Props { posA: RobotPos; posB: RobotPos; hpA: number; hpB: number; }

const SIM = 4;

function toCanvas(pos: RobotPos, S: number) {
  return {
    cx: ((pos.x + 2) / SIM) * S,
    cy: ((pos.y + 2) / SIM) * S,
  };
}

function drawBracket(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, flipX: boolean, flipY: boolean) {
  const dx = flipX ? -size : size;
  const dy = flipY ? -size : size;
  ctx.beginPath();
  ctx.moveTo(x + dx, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dy);
  ctx.stroke();
}

export function Arena({ posA, posB, hpA, hpB }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const S = canvas.width;

    ctx.clearRect(0, 0, S, S);

    // Floor — deep dark
    ctx.fillStyle = "#060612";
    ctx.fillRect(0, 0, S, S);

    // Diagonal grid
    ctx.save();
    ctx.strokeStyle = "rgba(30, 58, 138, 0.25)";
    ctx.lineWidth = 0.5;
    const spacing = S / 10;
    for (let i = -S; i < S * 2; i += spacing) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - S, S); ctx.stroke();
    }
    ctx.restore();

    // Center cross — subtle
    ctx.save();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Center circle
    ctx.save();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Outer wall with neon glow
    ctx.save();
    ctx.shadowColor = "#cc2222";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#7f1d1d";
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, S - 6, S - 6);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Corner brackets
    ctx.save();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.5;
    const br = 22;
    drawBracket(ctx, 3, 3, br, false, false);
    drawBracket(ctx, S - 3, 3, br, true, false);
    drawBracket(ctx, 3, S - 3, br, false, true);
    drawBracket(ctx, S - 3, S - 3, br, true, true);
    ctx.restore();

    // Distance line
    const a = toCanvas(posA, S);
    const b = toCanvas(posB, S);
    ctx.save();
    ctx.strokeStyle = "rgba(251,191,36,0.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(a.cx, a.cy); ctx.lineTo(b.cx, b.cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Robot A — blue neon
    ctx.save();
    ctx.shadowColor = "#3b82f6";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(a.cx, a.cy, 17, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(29, 78, 216, ${0.25 + 0.65 * (hpA / 100)})`;
    ctx.fill();
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "white";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", a.cx, a.cy);
    ctx.restore();

    // Robot A outer ring (HP indicator)
    ctx.save();
    ctx.strokeStyle = `rgba(96,165,250,${0.3 + 0.5 * (hpA / 100)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(a.cx, a.cy, 23, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * hpA) / 100);
    ctx.stroke();
    ctx.restore();

    // Robot B — red neon
    ctx.save();
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, 17, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(185, 28, 28, ${0.25 + 0.65 * (hpB / 100)})`;
    ctx.fill();
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "white";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", b.cx, b.cy);
    ctx.restore();

    // Robot B outer ring
    ctx.save();
    ctx.strokeStyle = `rgba(248,113,113,${0.3 + 0.5 * (hpB / 100)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, 23, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * hpB) / 100);
    ctx.stroke();
    ctx.restore();

    // Vignette
    const vignette = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, S, S);
  }, [posA, posB, hpA, hpB]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={340}
        height={340}
        className="w-full max-w-sm mx-auto block rounded-lg animate-border-flicker"
        style={{ imageRendering: "pixelated" }}
      />
      {/* Corner labels */}
      <span className="absolute top-1 left-2 text-[9px] font-mono text-blue-500/60 tracking-widest">ARENA-01</span>
      <span className="absolute top-1 right-2 text-[9px] font-mono text-red-500/60 tracking-widest">LIVE</span>
    </div>
  );
}
