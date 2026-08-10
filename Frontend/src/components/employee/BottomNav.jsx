// BottomNav.jsx — the mobile tab bar (Home/Tasks/Activity/Chat/Profile).
// Large tap targets (min-h-[56px], flex-1 columns) per the mobile-first
// touch-target work already applied elsewhere in this app. Purely
// presentational — AppShell owns which tab is active.
export default function BottomNav({ tabs, activeTab, onSelect }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#171C2E]/95 backdrop-blur-xl border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around max-w-4xl mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelect(tab.key)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors duration-150 ${
                isActive ? "text-[#F47A20]" : "text-[#8B93A8] hover:text-white"
              }`}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F47A20] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
