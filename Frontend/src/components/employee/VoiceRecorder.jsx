import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Send, Trash2, Loader2 } from "lucide-react";
import { readFileAsDataUrl, formatDuration } from "../../utils/fileEncoding";

// VoiceRecorder.jsx — tap to record, tap to stop, preview + Retake/Send.
// Uses MediaRecorder (no server round-trip needed to record) — if the
// browser denies mic permission or doesn't support MediaRecorder at all,
// this fails gracefully into an inline error instead of breaking the
// rest of Chat (spec: "Do not break chat for browsers that don't support
// recording"). REST-only, same as the rest of this app's chat
// architecture — no WebSocket involved in any of this.
export default function VoiceRecorder({ onRecorded, onCancel }) {
  const [state, setState] = useState("idle"); // idle | recording | recorded | unsupported
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [preparing, setPreparing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioElRef = useRef(null);

  useEffect(() => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
    }
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const recordedBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setBlob(recordedBlob);
        setPreviewUrl(URL.createObjectURL(recordedBlob));
        setState("recorded");
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Could not access the microphone. Check your browser/device permissions.");
      setState("idle");
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  function togglePlayback() {
    if (!audioElRef.current) return;
    if (playing) {
      audioElRef.current.pause();
    } else {
      audioElRef.current.play();
    }
    setPlaying((p) => !p);
  }

  function retake() {
    setPreviewUrl(null);
    setBlob(null);
    setPlaying(false);
    setSeconds(0);
    setState("idle");
  }

  async function handleSend() {
    if (!blob) return;
    setPreparing(true);
    try {
      const dataUrl = await readFileAsDataUrl(blob);
      onRecorded(dataUrl, seconds, blob.size);
    } finally {
      setPreparing(false);
    }
  }

  if (state === "unsupported") {
    return (
      <p className="text-xs text-[#8B93A8] px-1">
        Voice messages aren't supported in this browser. Try Upload Photo/File instead.
      </p>
    );
  }

  if (state === "idle") {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-[#F47A20] hover:bg-[#ff8b36]"
        >
          <Mic size={15} /> Record Voice Message
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-[#9AA1B4] hover:text-white">
          Cancel
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-mono text-white">{formatDuration(seconds)}</span>
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500"
        >
          <Square size={13} /> Stop
        </button>
      </div>
    );
  }

  // recorded — preview + Retake/Send
  return (
    <div className="flex items-center gap-3">
      <audio ref={audioElRef} src={previewUrl} onEnded={() => setPlaying(false)} className="hidden" />
      <button
        type="button"
        onClick={togglePlayback}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-white/[0.08] hover:bg-white/[0.14]"
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <span className="text-sm font-mono text-white">{formatDuration(seconds)}</span>
      <button type="button" onClick={retake} className="p-1.5 text-[#9AA1B4] hover:text-red-400" aria-label="Retake">
        <Trash2 size={15} />
      </button>
      <button
        type="button"
        onClick={handleSend}
        disabled={preparing}
        className="ml-auto flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50"
      >
        {preparing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        Send
      </button>
    </div>
  );
}
