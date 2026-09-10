import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, Building2 } from "lucide-react";
import Modal from "../common/Modal";
import EvidenceCapture from "./EvidenceCapture";
import { getProfile } from "../../services/profileService";
import { submitDepartmentClosing } from "../../services/departmentClosingService";
import { ApiError } from "../../services/apiClient";

function formatTimeNow() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

// DepartmentClosingFlow.jsx — "How did you leave your department?"
// (Phase 2 §5-8). Shows the employee's own real, currently-assigned
// department (fetched from GET /api/profile — never a picker, since the
// backend independently enforces this is the only department they can
// submit for regardless of what a client sends) -> photo (reusing
// EvidenceCapture, the same take/preview/retake component every other
// evidence photo in this app already uses) -> submit.
export default function DepartmentClosingFlow({ open, onClose, onSaved }) {
  const { t } = useTranslation();
  const [department, setDepartment] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(null); // { time } once successful

  useEffect(() => {
    if (!open) return;
    setLoadingProfile(true);
    getProfile()
      .then((profile) => setDepartment(profile.department ?? null))
      .catch(() => setError(t("emp.couldNotLoadYourDepartment")))
      .finally(() => setLoadingProfile(false));
  }, [open]);

  const reset = () => {
    setPhoto(null);
    setError(null);
    setSubmitted(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      const activity = await submitDepartmentClosing({
        date: now.toISOString().slice(0, 10),
        time: formatTimeNow(),
        status: "PENDING",
        imageUrls: photo ? [photo] : undefined,
      });
      setSubmitted({ time: formatTimeNow() });
      onSaved?.(activity, t("emp.departmentClosingSubmitted"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("emp.couldNotSubmitPleaseTryAgain"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={t("emp.departmentClosing")}>
      {loadingProfile ? (
        <p className="text-sm text-[#4C5266] text-center py-6">{t("emp.loading")}</p>
      ) : submitted ? (
        <div className="text-center py-6">
          <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-sm font-semibold text-white">{t("emp.submitted")}</p>
          <p className="text-xs text-[#8B93A8] mt-1">{submitted.time}</p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-5 w-full rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors duration-200"
          >
            {t("emp.done")}
          </button>
        </div>
      ) : !department ? (
        <div className="text-center py-6">
          <p className="text-sm text-[#8B93A8]">{t("emp.youHaveNoDepartmentAssignedYet")}</p>
          <p className="text-xs text-[#6B7284] mt-1">{t("emp.askYourSupervisorToAssignOne")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl p-4 bg-[#1A1F33]/70 border border-white/[0.05]">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8B93A8]">
              <Building2 size={12} /> {t("emp.yourDepartment")}
            </p>
            <p className="mt-1 text-lg font-display font-bold text-white">{department}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#8B93A8] mb-2">{t("emp.howDidYouLeaveIt")}</p>
            <EvidenceCapture photo={photo} onPhotoChange={setPhoto} />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:bg-[#e06f18] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {submitting ? t("emp.submitting") : t("emp.submit")}
          </button>
        </div>
      )}
    </Modal>
  );
}
