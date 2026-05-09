import { useVoice } from "../hooks/useVoice";
import { useSeekerSocket } from "../hooks/useWebSocket";

interface Props {
  arenaId: number;
  robotId: "robot_a" | "robot_b";
}

const ROBOT_LABELS = { robot_a: "Robot A (Blue)", robot_b: "Robot B (Red)" };

export function VoiceControl({ arenaId, robotId }: Props) {
  const { connected, lastAction, sendVoiceText, sendVoiceAudio } = useSeekerSocket(arenaId, robotId);

  const { state, startRecording, stopRecording } = useVoice((base64) => {
    sendVoiceAudio(base64);
  });

  const handleTextDemo = () => {
    const commands = ["Attack!", "Move forward!", "Retreat!", "Boost now!", "Spin left!"];
    sendVoiceText(commands[Math.floor(Math.random() * commands.length)]);
  };

  const btnBase =
    "w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200 shadow-lg select-none";
  const btnRecord =
    state === "recording"
      ? `${btnBase} bg-red-600 scale-95 animate-pulse text-white`
      : state === "processing"
      ? `${btnBase} bg-yellow-500 text-black cursor-wait`
      : `${btnBase} bg-blue-600 hover:bg-blue-500 active:scale-95 text-white`;

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-2xl border border-gray-700">
      <div className="flex items-center justify-between">
        <span className="font-bold text-white">{ROBOT_LABELS[robotId]}</span>
        <span className={`text-xs px-2 py-1 rounded-full ${connected ? "bg-green-800 text-green-300" : "bg-gray-700 text-gray-400"}`}>
          {connected ? "Connected" : "Offline"}
        </span>
      </div>

      <button
        className={btnRecord}
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={stopRecording}
      >
        {state === "recording" ? "🔴 Listening…" : state === "processing" ? "⏳ Processing…" : "🎤 Hold to Command"}
      </button>

      <button
        onClick={handleTextDemo}
        className="w-full py-2 rounded-xl text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
      >
        ⚡ Quick Demo Command
      </button>

      {lastAction && (
        <p className="text-center text-xs text-green-400 font-mono">
          Last action: <span className="font-bold">{lastAction}</span>
        </p>
      )}
    </div>
  );
}
