import { useVoice } from "../hooks/useVoice";
import { useSeekerSocket } from "../hooks/useWebSocket";

interface Props {
  arenaId: number;
  robotId: "robot_a" | "robot_b";
}

const SIDE: Record<string, { label: string; short: string; color: string; glow: string; border: string }> = {
  robot_a: {
    label: "UNIT ALPHA",
    short: "A",
    color: "bg-blue-600 hover:bg-blue-500 active:scale-95",
    glow: "animate-glow-blue",
    border: "border-blue-900/60",
  },
  robot_b: {
    label: "UNIT BETA",
    short: "B",
    color: "bg-red-700 hover:bg-red-600 active:scale-95",
    glow: "animate-glow-red",
    border: "border-red-900/60",
  },
};

const DEMO_CMDS = ["Attack!", "Move forward!", "Retreat!", "Boost!", "Spin left!", "Charge!"];

export function VoiceControl({ arenaId, robotId }: Props) {
  const { connected, lastAction, sendVoiceText, sendVoiceAudio } = useSeekerSocket(arenaId, robotId);
  const { state, startRecording, stopRecording } = useVoice((b64) => sendVoiceAudio(b64));
  const cfg = SIDE[robotId];

  const handleDemo = () => {
    sendVoiceText(DEMO_CMDS[Math.floor(Math.random() * DEMO_CMDS.length)]);
  };

  const isRecording = state === "recording";
  const isProcessing = state === "processing";

  return (
    <div className={`flex flex-col gap-3 p-3 rounded-lg border bg-[#08080f] ${cfg.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${cfg.color} transition-none`}
          >
            {cfg.short}
          </span>
          <span className="text-[10px] tracking-[0.2em] font-bold text-gray-300">{cfg.label}</span>
        </div>
        <span
          className={`text-[9px] px-2 py-0.5 rounded-full font-mono border ${
            connected
              ? "border-green-800 text-green-400 bg-green-950/50"
              : "border-gray-800 text-gray-600 bg-transparent"
          }`}
        >
          {connected ? "● LINKED" : "○ OFFLINE"}
        </span>
      </div>

      {/* Record button */}
      <button
        className={`w-full py-4 rounded-lg font-black text-sm tracking-widest uppercase transition-all duration-150 shadow-lg select-none border
          ${isRecording
            ? "bg-red-600 border-red-500 text-white scale-95 animate-pulse"
            : isProcessing
            ? "bg-yellow-600 border-yellow-500 text-black cursor-wait"
            : `${cfg.color} ${cfg.glow} border-transparent text-white`
          }`}
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={stopRecording}
      >
        {isRecording ? "⬤ LISTENING" : isProcessing ? "◌ PROCESSING" : "◎ HOLD TO COMMAND"}
      </button>

      {/* Demo */}
      <button
        onClick={handleDemo}
        className="w-full py-1.5 rounded text-[10px] tracking-widest uppercase font-bold bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-800 transition-colors"
      >
        ⚡ DEMO COMMAND
      </button>

      {/* Last action */}
      {lastAction && (
        <p className="text-center text-[10px] text-green-400 font-mono tracking-wider animate-slide-up">
          CMD: <span className="font-bold text-green-300">{JSON.stringify(lastAction)}</span>
        </p>
      )}
    </div>
  );
}
