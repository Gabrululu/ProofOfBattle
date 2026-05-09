interface Props {
  hp: number;
  label: string;
  color: "blue" | "red";
  flip?: boolean;
}

export function HealthBar({ hp, label, color, flip = false }: Props) {
  const pct = Math.max(0, Math.min(100, hp));
  const barColor =
    pct > 50 ? (color === "blue" ? "bg-blue-500" : "bg-red-500") :
    pct > 25 ? "bg-yellow-400" : "bg-red-600 animate-pulse";

  return (
    <div className={`flex flex-col gap-1 w-full ${flip ? "items-end" : "items-start"}`}>
      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{label}</span>
      <div className="w-full h-5 bg-gray-800 rounded-full border border-gray-600 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor} ${flip ? "ml-auto" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-mono font-bold text-white">{hp} HP</span>
    </div>
  );
}
