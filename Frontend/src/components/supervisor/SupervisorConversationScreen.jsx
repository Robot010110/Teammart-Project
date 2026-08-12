import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Loader2, ShieldAlert } from "lucide-react";

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// SupervisorConversationScreen.jsx — one generic thread view, reused for
// every channel type (mock-backed Zone Manager Group/Direct, Overlooking
// Direct, Market Group, Individual Employee chats — and the one real
// channel, Warnings, whose send goes to the real backend). `onSend`
// abstracts the difference: mock channels resolve locally, Warnings
// calls the real postWarningBroadcast. `readOnly` disables the composer
// entirely (used nowhere today, kept for a future channel type where the
// Supervisor genuinely can't post).
export default function SupervisorConversationScreen({ title, isWarnings, messages, onSend, onBack, sending, sendError }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    const ok = await onSend(body);
    if (ok) setDraft("");
  }

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-96px)]">
      <div className="px-4 sm:px-6 py-4 flex items-center gap-2 border-b border-white/[0.06]">
        <button type="button" onClick={onBack} className="p-1.5 -ml-1.5 text-[#9AA1B4] hover:text-white">
          <ArrowLeft size={18} />
        </button>
        {isWarnings && <ShieldAlert size={16} className="text-amber-400" />}
        <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2.5">
        {!messages || messages.length === 0 ? (
          <p className="text-center text-xs text-[#4C5266] py-10">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                  m.fromMe
                    ? "bg-[#F47A20] text-white rounded-br-md"
                    : isWarnings
                    ? "bg-amber-500/10 border border-amber-500/20 text-white rounded-bl-md"
                    : "bg-[#1A1F33]/80 border border-white/[0.06] text-white rounded-bl-md"
                }`}
              >
                {!m.fromMe && m.from && <p className="text-[11px] font-semibold text-[#F47A20] mb-0.5">{m.from}</p>}
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 ${m.fromMe ? "text-white/70" : "text-[#8B93A8]"}`}>{timeLabel(m.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 sm:px-6 py-3 border-t border-white/[0.06]">
        {isWarnings && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-400/90">
            <ShieldAlert size={12} /> Posts here reach every employee in your market as an announcement.
          </p>
        )}
        {sendError && <p className="mb-2 text-xs text-red-400">{sendError}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Message..."
            className="flex-1 min-w-0 resize-none rounded-xl bg-white/[0.04] border border-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 max-h-28"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
          >
            {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
}
