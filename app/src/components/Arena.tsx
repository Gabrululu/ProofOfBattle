import { useEffect, useRef } from "react";

interface RobotPos {
  x: number;
  y: number;
}

interface Props {
  posA: RobotPos;
  posB: RobotPos;
  hpA: number;
  hpB: number;
}

const ARENA_SIZE = 4; // meters in simulation

function toCanvas(pos: RobotPos, size: number) {
  // Simulation coords: -2..+2 → canvas 0..size
  return {
    cx: ((pos.x + 2) / ARENA_SIZE) * size,
    cy: ((pos.y + 2) / ARENA_SIZE) * size,
  };
}

export function Arena({ posA, posB, hpA, hpB }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const S = canvas.width;

    ctx.clearRect(0, 0, S, S);

    // Floor
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, S, S);

    // Grid lines
    ctx.strokeStyle = "#2a2a4a";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = (i / 4) * S;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
    }

    // Border / wall
    ctx.strokeStyle = "#cc3333";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, S - 6, S - 6);

    // Robot A
    const a = toCanvas(posA, S);
    ctx.beginPath();
    ctx.arc(a.cx, a.cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(30, 100, 255, ${0.4 + 0.6 * (hpA / 100)})`;
    ctx.fill();
    ctx.strokeStyle = "#4488ff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", a.cx, a.cy);

    // Robot B
    const b = toCanvas(posB, S);
    ctx.beginPath();
    ctx.arc(b.cx, b.cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 50, 50, ${0.4 + 0.6 * (hpB / 100)})`;
    ctx.fill();
    ctx.strokeStyle = "#ff4444";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", b.cx, b.cy);

    // Distance line
    ctx.beginPath();
    ctx.moveTo(a.cx, a.cy);
    ctx.lineTo(b.cx, b.cy);
    ctx.strokeStyle = "rgba(255,255,0,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [posA, posB, hpA, hpB]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className="rounded-xl border-2 border-gray-600 w-full max-w-xs mx-auto block"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
