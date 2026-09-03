import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

// PasswordField.jsx — same glass treatment as CredentialField, plus the
// real show/hide toggle the brief asks for. `type` toggling between
// "password"/"text" is the only thing that ever changes — nothing about
// how the value is stored or submitted.
export default function PasswordField({ value, onChange, error, placeholder = "Enter your password" }) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8B93A8] mb-1.5">Password</label>
      <div className="relative">
        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6479]" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl bg-white/[0.045] border pl-10 pr-11 py-3.5 text-[15px] text-white placeholder:text-[#4C5266] outline-none backdrop-blur-sm transition-all duration-200 ${
            error ? "border-red-500/50 focus:border-red-500/70" : "border-white/[0.08] focus:border-[#F47A20]/60 focus:shadow-[0_0_0_3px_rgba(244,122,32,0.12)]"
          }`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C6479] hover:text-[#9AA1B4] p-1.5 transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
