// CredentialField.jsx — the glass-styled text input every login screen's
// identifier field (Employee Code / User ID / Email) uses. One component
// so focus glow, icon placement, and error styling stay identical
// everywhere rather than three near-duplicate inputs.
export default function CredentialField({ icon: Icon, label, value, onChange, placeholder, type = "text", error, autoFocus }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#8B93A8] mb-1.5">{label}</label>
      <div className="relative">
        <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6479]" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          className={`w-full rounded-xl bg-white/[0.045] border pl-10 pr-3.5 py-3.5 text-[15px] text-white placeholder:text-[#4C5266] outline-none backdrop-blur-sm transition-all duration-200 ${
            error ? "border-red-500/50 focus:border-red-500/70" : "border-white/[0.08] focus:border-[#F47A20]/60 focus:shadow-[0_0_0_3px_rgba(244,122,32,0.12)]"
          }`}
        />
      </div>
    </div>
  );
}
