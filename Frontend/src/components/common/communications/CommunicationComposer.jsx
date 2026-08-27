import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Send, CheckCircle2 } from "lucide-react";
import { useAsync } from "../../../hooks/useAsync";
import ErrorBanner from "../ErrorBanner";
import SenderIdentityBadge from "../SenderIdentityBadge";
import { ApiError } from "../../../services/apiClient";
import { listZones } from "../../../services/zoneService";
import { listMarkets } from "../../../services/marketService";
import { listAuthorizedStaffContacts } from "../../../services/chatService";
import { previewCommunication, sendCommunication, newClientRequestId } from "../../../services/communicationsService";
import { DEPARTMENTS } from "../../../utils/departments";

// CommunicationComposer.jsx — Warnings & Notifications §38: the real
// composer, shared by Admin and Zone Manager (REGIONAL_MANAGER) — one
// component, not two near-duplicate role-specific ones, since the only
// real difference between them is which scopes/zones/markets the backend
// (listZones/listMarkets, already server-scoped per session's role — see
// those services' own comments) hands back and whether ALL_MARKETS is
// offered. 12 conceptual fields (spec §38), grouped into 5 real screens
// so this stays usable on a phone rather than one giant form.
//
// Every option this shows for role/department/market/zone comes from
// either the fixed backend enum values (Type/Category/Priority/Role —
// same as this app already hardcodes SHIFTS=[MORNING,EVENING,NIGHT]
// elsewhere; these are protocol values, not organizational data) or a
// real backend query (Zones/Markets/Departments) — never an invented
// list. Frontend filtering here is UX only; every one of these is
// re-validated server-side on preview AND send (communicationTargeting.js).

const TYPES = [
  { value: "ANNOUNCEMENT", label: "Announcement" },
  { value: "WARNING", label: "Warning" },
  { value: "TASK", label: "Task" },
  { value: "INFORMATION", label: "Information" },
];
const CATEGORIES = [
  { value: "STOCK_CHECK", label: "Stock Check" },
  { value: "COUNTING", label: "Counting" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "PRICE", label: "Price" },
  { value: "LABEL", label: "Label" },
  { value: "EXPIRY", label: "Expiry" },
  { value: "INVENTORY", label: "Inventory" },
  { value: "GENERAL", label: "General" },
];
const ROLES = [
  { value: "WORKER", label: "Worker" },
  { value: "CASHIER", label: "Cashier" },
  { value: "BUTCHER", label: "Butcher" },
  { value: "EVERYONE", label: "Everyone" },
];
const PRIORITIES = [
  { value: "NORMAL", label: "Normal" },
  { value: "IMPORTANT", label: "Important" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];
const ACTIONS = [
  { value: "INFORMATIONAL", label: "Informational", hint: "No action required" },
  { value: "ACKNOWLEDGEMENT", label: "Acknowledge", hint: "Employee must confirm they saw it" },
  { value: "COMPLETION", label: "Complete", hint: "Employee must start and submit a result" },
];

const STEPS = ["type", "target", "scope", "content", "review"];

const emptyForm = {
  type: "ANNOUNCEMENT",
  category: "GENERAL",
  targetRole: "WORKER",
  targetDepartment: "",
  scopeType: "MARKET",
  zoneId: "",
  marketId: "",
  targetSupervisorId: "",
  title: "",
  message: "",
  priority: "NORMAL",
  deadline: "",
  actionType: "INFORMATIONAL",
};

export default function CommunicationComposer({ session, basePath }) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sent, setSent] = useState(null);
  const [clientRequestId] = useState(newClientRequestId);

  const isAdmin = session.staffRole === "ADMIN";
  const { data: zones } = useAsync(listZones, { deps: [] });
  const { data: markets } = useAsync(listMarkets, { deps: [] });
  // Zone.number ("Zone 2"), not Zone.id — session.zoneIds carries the FK,
  // zones (a real, already-scoped backend query) is where the human
  // label actually lives. Same distinction communicationsController.js
  // makes for senderZoneSnapshot; picking [0] here is just "which zone to
  // show next to the sender's own name before they've chosen a scope" for
  // a Regional Manager with more than one zone — not an authorization
  // decision.
  const senderZoneNumber = zones?.[0]?.number;

  const marketsInZone = (markets || []).filter((m) => (form.scopeType !== "ZONE" || !form.zoneId ? true : String(m.zoneId) === String(form.zoneId)));
  const departmentIrrelevant = form.targetRole === "CASHIER" || form.targetRole === "EVERYONE" || form.scopeType === "SPECIFIC_SUPERVISOR";

  // Verification pass §1 — reuses the EXACT same backend-scoped contact
  // list the RM<->Supervisor chat feature already uses (never a second,
  // hand-rolled "which supervisors can I see" query) — an Admin gets
  // every staff account, a Regional Manager only their own zone's.
  const { data: staffContacts } = useAsync(listAuthorizedStaffContacts, { deps: [] });
  const supervisorContacts = (staffContacts || []).filter((c) => c.role === "SUPERVISOR" || c.role === "OVERLOOKING_SUPERVISOR");

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
    setPreview(null);
  }

  function targetingPayload() {
    if (form.scopeType === "SPECIFIC_SUPERVISOR") {
      // Role/Department don't apply to this scope at all (backend nulls
      // them regardless — see communicationsController.sendCommunication).
      return { scopeType: form.scopeType, targetSupervisorId: Number(form.targetSupervisorId) };
    }
    return {
      scopeType: form.scopeType,
      zoneId: form.scopeType !== "MARKET" ? (form.zoneId ? Number(form.zoneId) : undefined) : undefined,
      marketId: form.scopeType === "MARKET" ? form.marketId : undefined,
      targetRole: form.targetRole,
      targetDepartment: !departmentIrrelevant && form.targetDepartment.trim() ? form.targetDepartment.trim() : undefined,
    };
  }

  async function runPreview() {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const result = await previewCommunication(targetingPayload());
      setPreview(result.recipientCount);
    } catch (err) {
      setPreviewError(err instanceof ApiError ? err.message : "Could not calculate the recipient count.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setSendError(null);
    try {
      const result = await sendCommunication({
        ...targetingPayload(),
        type: form.type,
        category: form.category,
        title: form.title.trim(),
        message: form.message.trim(),
        priority: form.priority,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
        actionType: form.actionType,
        clientRequestId,
      });
      setSent(result);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Could not send this communication. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const step = STEPS[stepIndex];
  const canGoNext =
    (step === "type" && form.type && form.category) ||
    (step === "target" && (form.targetRole || form.scopeType === "SPECIFIC_SUPERVISOR")) ||
    (step === "scope" && form.scopeType && (
      form.scopeType === "ALL_MARKETS" ||
      (form.scopeType === "ZONE" && form.zoneId) ||
      (form.scopeType === "MARKET" && form.marketId) ||
      (form.scopeType === "SPECIFIC_SUPERVISOR" && form.targetSupervisorId)
    )) ||
    (step === "content" && form.title.trim() && form.message.trim());

  function goNext() {
    if (step === "content") runPreview();
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  if (sent) {
    return (
      <div className="px-4 sm:px-6 py-10 max-w-2xl mx-auto text-center animate-fade-up">
        <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-4" />
        <h1 className="text-lg font-semibold text-white mb-1">Communication Sent</h1>
        <p className="text-sm text-[#9AA1B4] mb-6">Delivered to {sent.recipientCount} employee{sent.recipientCount === 1 ? "" : "s"}.</p>
        <button
          type="button"
          onClick={() => navigate(`${basePath}/communications`)}
          className="rounded-xl px-5 py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] transition-colors"
        >
          View Sent History
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-white">New Communication</h1>
        <SenderIdentityBadge senderRole={session.staffRole} senderZone={senderZoneNumber} size="sm" />
      </div>
      <p className="text-xs text-[#6B7284] mb-5">Step {stepIndex + 1} of {STEPS.length}</p>

      <div className="rounded-2xl p-5 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl min-h-[320px]">
        {step === "type" && (
          <div className="space-y-5">
            <Field label="Type">
              <ChipGroup options={TYPES} value={form.type} onChange={(v) => update({ type: v })} />
            </Field>
            <Field label="Category">
              <ChipGroup options={CATEGORIES} value={form.category} onChange={(v) => update({ category: v })} />
            </Field>
          </div>
        )}

        {step === "target" && (
          <div className="space-y-5">
            <Field label="Target Role">
              <ChipGroup options={ROLES} value={form.targetRole} onChange={(v) => update({ targetRole: v, targetDepartment: "" })} />
            </Field>
            {!departmentIrrelevant && (
              <Field label="Department / Responsibility" hint="Matches an employee's Main OR any Additional department.">
                <select value={form.targetDepartment} onChange={(e) => update({ targetDepartment: e.target.value })} className={selectClass}>
                  <option value="">All Departments</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            )}
          </div>
        )}

        {step === "scope" && (
          <div className="space-y-5">
            <Field label="Scope">
              <ChipGroup
                options={[
                  { value: "MARKET", label: "Specific Market" },
                  { value: "ZONE", label: "Entire Zone" },
                  ...(isAdmin ? [{ value: "ALL_MARKETS", label: "All Markets" }] : []),
                  { value: "SPECIFIC_SUPERVISOR", label: "Specific Supervisor" },
                ]}
                value={form.scopeType}
                onChange={(v) => update({ scopeType: v, zoneId: "", marketId: "", targetSupervisorId: "" })}
              />
            </Field>
            {form.scopeType === "SPECIFIC_SUPERVISOR" && (
              <Field label="Supervisor" hint="Only Supervisors/Overlooking accounts inside your own authorized scope are selectable — the same list the Chat tab's Important People already uses.">
                <select value={form.targetSupervisorId} onChange={(e) => update({ targetSupervisorId: e.target.value })} className={selectClass}>
                  <option value="">Select a Supervisor...</option>
                  {supervisorContacts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role === "OVERLOOKING_SUPERVISOR" ? "Overlooking" : "Supervisor"})</option>)}
                </select>
                {supervisorContacts.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-amber-400">No Supervisors are currently in your authorized scope.</p>
                )}
              </Field>
            )}
            {form.scopeType === "ZONE" && (
              <Field label="Zone">
                <select value={form.zoneId} onChange={(e) => update({ zoneId: e.target.value })} className={selectClass}>
                  <option value="">Select a zone...</option>
                  {(zones || []).map((z) => <option key={z.id} value={z.id}>Zone {z.number}</option>)}
                </select>
              </Field>
            )}
            {form.scopeType === "MARKET" && (
              <Field label="Market">
                <select value={form.marketId} onChange={(e) => update({ marketId: e.target.value })} className={selectClass}>
                  <option value="">Select a market...</option>
                  {marketsInZone.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
            )}
          </div>
        )}

        {step === "content" && (
          <div className="space-y-5">
            <Field label="Title">
              <input value={form.title} onChange={(e) => update({ title: e.target.value })} maxLength={150} className={selectClass} placeholder="e.g. Drinks Department Stock Check" />
            </Field>
            <Field label="Message">
              <textarea value={form.message} onChange={(e) => update({ message: e.target.value })} rows={4} maxLength={4000} className={`${selectClass} resize-none`} placeholder="What do you need to communicate?" />
            </Field>
            <Field label="Priority">
              <ChipGroup options={PRIORITIES} value={form.priority} onChange={(v) => update({ priority: v })} />
            </Field>
            <Field label="Deadline (optional)">
              <input type="datetime-local" value={form.deadline} onChange={(e) => update({ deadline: e.target.value })} className={selectClass} />
            </Field>
            <Field label="Action Required">
              <div className="space-y-2">
                {ACTIONS.map((a) => (
                  <button
                    key={a.value} type="button" onClick={() => update({ actionType: a.value })}
                    className={`w-full text-left rounded-lg px-3 py-2.5 border transition-colors ${form.actionType === a.value ? "border-[#F47A20]/50 bg-[#F47A20]/10" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"}`}
                  >
                    <p className="text-sm font-medium text-white">{a.label}</p>
                    <p className="text-[11px] text-[#8B93A8]">{a.hint}</p>
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">Review Notification</h2>
            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06] space-y-1.5 text-xs text-[#9AA1B4]">
              <ReviewRow label="Sender" value={<SenderIdentityBadge senderRole={session.staffRole} senderZone={senderZoneNumber} size="sm" />} />
              <ReviewRow label="Type" value={TYPES.find((t) => t.value === form.type)?.label} />
              <ReviewRow label="Category" value={CATEGORIES.find((c) => c.value === form.category)?.label} />
              {form.scopeType === "SPECIFIC_SUPERVISOR" ? (
                <ReviewRow label="Target" value={supervisorContacts.find((s) => String(s.id) === String(form.targetSupervisorId))?.name} />
              ) : (
                <>
                  <ReviewRow label="Role" value={ROLES.find((r) => r.value === form.targetRole)?.label} />
                  <ReviewRow label="Department" value={departmentIrrelevant ? "N/A" : (form.targetDepartment || "All Departments")} />
                  <ReviewRow label="Scope" value={form.scopeType === "MARKET" ? marketsInZone.find((m) => m.id === form.marketId)?.name : form.scopeType === "ZONE" ? `Zone ${(zones || []).find((z) => String(z.id) === String(form.zoneId))?.number ?? ""}` : "All Markets"} />
                </>
              )}
              <ReviewRow label="Priority" value={PRIORITIES.find((p) => p.value === form.priority)?.label} />
              {form.deadline && <ReviewRow label="Deadline" value={new Date(form.deadline).toLocaleString()} />}
              <ReviewRow label="Action" value={ACTIONS.find((a) => a.value === form.actionType)?.label} />
            </div>
            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06]">
              <p className="text-sm font-semibold text-white">{form.title}</p>
              <p className="text-sm text-[#D5D9E5] mt-1.5 whitespace-pre-wrap">{form.message}</p>
            </div>

            <div className="rounded-xl p-4 bg-[#F47A20]/5 border border-[#F47A20]/20">
              {previewing ? (
                <p className="flex items-center gap-2 text-sm text-[#9AA1B4]"><Loader2 size={14} className="animate-spin" /> Calculating recipients...</p>
              ) : previewError ? (
                <ErrorBanner message={previewError} onRetry={runPreview} />
              ) : preview === 0 ? (
                <p className="text-sm text-amber-400">No employees match the selected criteria. Go back and adjust your targeting.</p>
              ) : preview != null ? (
                <p className="text-sm text-white">Target audience: <span className="font-semibold">{preview} employee{preview === 1 ? "" : "s"}</span></p>
              ) : null}
            </div>

            {sendError && <p className="text-xs text-red-400">{sendError}</p>}
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-3">
        {stepIndex > 0 && (
          <button type="button" onClick={goBack} className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium text-[#9AA1B4] bg-white/[0.05] hover:bg-white/[0.1] transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
        )}
        {step !== "review" ? (
          <button
            type="button" onClick={goNext} disabled={!canGoNext}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors"
          >
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <button
            type="button" onClick={handleSend} disabled={sending || !preview}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Sending..." : "Send Notification"}
          </button>
        )}
      </div>
    </div>
  );
}

const selectClass = "w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-[#4C5266]">{hint}</p>}
    </div>
  );
}

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${value === o.value ? "text-white bg-[#F47A20]" : "text-[#9AA1B4] bg-white/[0.04] hover:bg-white/[0.08]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="text-white text-right">{value ?? "—"}</span>
    </div>
  );
}
