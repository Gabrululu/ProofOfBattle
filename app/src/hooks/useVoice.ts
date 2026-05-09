import { useCallback, useRef, useState } from "react";

export type VoiceState = "idle" | "recording" | "processing";

export function useVoice(onResult: (base64: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    if (state !== "idle") return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      setState("processing");
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      onResult(base64);
      stream.getTracks().forEach((t) => t.stop());
      setState("idle");
    };

    recorder.start();
    setState("recording");
  }, [state, onResult]);

  const stopRecording = useCallback(() => {
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
    }
  }, []);

  return { state, startRecording, stopRecording };
}
