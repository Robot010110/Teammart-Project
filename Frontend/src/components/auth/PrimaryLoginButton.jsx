import { ArrowRight, Loader2 } from "lucide-react";

// PrimaryLoginButton.jsx — the one real Sign In button every login
// screen uses. `submitting` disables it and swaps in a spinner
// (prevents a double network request on a slow connection — real
// loading state, not decorative); the button never claims success on
// its own, the caller only navigates once its real onLogin actually
// fires with a real session.
export default function PrimaryLoginButton({ submitting, disabled }) {
  return (
    <button
      type="submit"
      disabled={submitting || disabled}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-[15px] font-semibold text-white bg-gradient-to-r from-[#F47A20] to-[#E0561A] hover:from-[#ff8b36] hover:to-[#F47A20] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_-4px_rgba(244,122,32,0.7)] transition-all duration-200"
    >
      {submitting ? (
        <>
          <Loader2 size={18} className="animate-spin" /> Signing in...
        </>
      ) : (
        <>
          Sign In <ArrowRight size={18} />
        </>
      )}
    </button>
  );
}
