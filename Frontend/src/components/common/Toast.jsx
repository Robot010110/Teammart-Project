// Toast.jsx — the fixed-bottom "did it work" message, paired with
// useToast.js. Extracted out of EmployeeWorkspace.jsx once
// ItemReportSection.jsx needed the exact same markup.
export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-2rem)] rounded-xl px-4 py-2.5 bg-[#1F2436] border border-white/10 shadow-2xl text-sm text-white animate-fade-up"
    >
      {message}
    </div>
  );
}
