// BottomNav.jsx — the mobile tab bar (Home/Tasks/Activity/Chat/Profile).
// Redesigned as a floating premium pill (TeamMart visual system pass):
// the active tab gets an orange glow pill behind its icon, smoothly
// cross-fading in via CSS transitions on class change — no JS-measured
// sliding indicator, so it can never desync from the real active route.
// Large tap targets (min-h-[56px], flex-1 columns) unchanged. Purely
// presentational — AppShell owns which tab is active, real routing
// unchanged.
export default function BottomNav({ tabs, activeTab, onSelect }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="max-w-4xl mx-auto flex items-stretch justify-around rounded-2xl bg-[#171C2E]/95 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelect(tab.key)}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 min-h-[56px]"
            >
              <span
                className={`relative flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-300 ease-out ${
                  isActive ? "bg-[#F47A20]/15 shadow-[0_0_16px_2px_rgba(244,122,32,0.35)]" : ""
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.3 : 1.8}
                  className={`transition-colors duration-300 ${isActive ? "text-[#F47A20]" : "text-[#8B93A8]"}`}
                />
                {tab.badge ? (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F47A20] text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-[0_0_6px_rgba(244,122,32,0.6)]">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                ) : null}
              </span>
              <span className={`text-[11px] font-medium transition-colors duration-300 ${isActive ? "text-[#F47A20]" : "text-[#8B93A8]"}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
