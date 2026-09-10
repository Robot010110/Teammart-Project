import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import RmReportsSection from "./RmReportsSection";

// RmAttentionPage.jsx — the destination behind Home's "Attention →
// View All". Deliberately a thin header around the existing
// RmReportsSection rather than a second reports UI: same real
// MarketProblem rows, same zone scoping, same status/delete actions
// the Chat hub's Reports view already provides. Home's Attention rows
// and this page can never disagree, because they are the same data
// and the same component.
export default function RmAttentionPage({ session, onBack }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-2xl animate-fade-up px-4 pb-4 pt-5 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("emp.backToHome")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition-all hover:bg-white/10 active:scale-95"
        >
          <ArrowLeft size={16} className="rtl-flip" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-white">{t("rm.attention")}</h1>
          <p className="text-[12px] text-[#8B93A8]">{t("rm.openReportsAcrossYourMarkets")}</p>
        </div>
      </div>

      <RmReportsSection zoneIds={session.zoneIds ?? []} />
    </div>
  );
}
