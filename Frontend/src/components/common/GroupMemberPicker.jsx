import { useEffect, useRef, useState } from "react";
import { Search, Check, X } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { listGroupMemberCandidates } from "../../services/chatService";
import { initialsOf } from "../../utils/initials";

// GroupMemberPicker.jsx — Chat UI redesign: the shared person-by-person
// picker used by group creation (CreateGroupModal.jsx/
// RmCreateGroupModal.jsx/AdminCreateGroupModal.jsx) and GroupInfoModal's
// "Add member", replacing the old "pick a market, then checkbox its
// employees" flow. Candidates come from GET
// /conversations/groups/candidates?search= — already scoped server-side
// to whoever the caller may actually reach (see
// chatController.listGroupMemberCandidates), so this component never
// needs to know the caller's role or filter anything client-side beyond
// the free-text search box itself.
//
// Controlled: `selected` is { employeeIds: Set<string>, staffUserIds:
// Set<number> }, `onChange` receives the next Set pair on every toggle.
// Names of every candidate seen across searches are cached locally (a
// ref, not state) purely so the "selected" chip row can still show a
// real name for someone picked in an earlier search whose result has
// since scrolled out of view — never re-fetched, never guessed.
export default function GroupMemberPicker({ selected, onChange, excludeStaffUserIds = [] }) {
  const [query, setQuery] = useState("");
  const { data, loading } = useAsync(() => listGroupMemberCandidates(query.trim()), { deps: [query] });
  const nameCache = useRef(new Map());

  useEffect(() => {
    for (const s of data?.staff ?? []) nameCache.current.set(`staff-${s.id}`, s.name);
    for (const e of data?.employees ?? []) nameCache.current.set(`emp-${e.id}`, e.name);
  }, [data]);

  function toggleEmployee(id) {
    const next = new Set(selected.employeeIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange({ ...selected, employeeIds: next });
  }

  function toggleStaff(id) {
    const next = new Set(selected.staffUserIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange({ ...selected, staffUserIds: next });
  }

  const staff = (data?.staff ?? []).filter((s) => !excludeStaffUserIds.includes(s.id));
  const employees = data?.employees ?? [];

  const chips = [
    ...[...selected.staffUserIds].map((id) => ({ kind: "staff", id, name: nameCache.current.get(`staff-${id}`) ?? "Staff" })),
    ...[...selected.employeeIds].map((id) => ({ kind: "employee", id, name: nameCache.current.get(`emp-${id}`) ?? "Employee" })),
  ];

  return (
    <div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {chips.map((chip) => (
            <span key={`${chip.kind}-${chip.id}`} className="flex items-center gap-1 rounded-full pl-2.5 pr-1.5 py-1 text-[11px] bg-[#F47A20]/15 text-[#F47A20] border border-[#F47A20]/30">
              {chip.name}
              <button type="button" onClick={() => (chip.kind === "staff" ? toggleStaff(chip.id) : toggleEmployee(chip.id))} className="p-0.5 hover:text-white">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative mb-2.5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4C5266]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people to add..."
          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50"
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
        {loading ? (
          <p className="text-center text-xs text-[#4C5266] py-4">Loading...</p>
        ) : (
          <>
            {staff.map((s) => (
              <button
                key={`staff-${s.id}`}
                type="button"
                onClick={() => toggleStaff(s.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  selected.staffUserIds.has(s.id) ? "bg-[#F47A20]/15 border border-[#F47A20]/40" : "bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12]"
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                  {initialsOf(s.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{s.name}</p>
                  <p className="text-[11px] text-[#8B93A8]">{s.role?.replace(/_/g, " ")}</p>
                </span>
                {selected.staffUserIds.has(s.id) && <Check size={15} className="text-[#F47A20] shrink-0" />}
              </button>
            ))}
            {employees.map((e) => (
              <button
                key={`emp-${e.id}`}
                type="button"
                onClick={() => toggleEmployee(e.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  selected.employeeIds.has(e.id) ? "bg-[#F47A20]/15 border border-[#F47A20]/40" : "bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12]"
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                  {initialsOf(e.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{e.name}</p>
                  <p className="text-[11px] text-[#8B93A8]">{e.position}</p>
                </span>
                {selected.employeeIds.has(e.id) && <Check size={15} className="text-[#F47A20] shrink-0" />}
              </button>
            ))}
            {staff.length === 0 && employees.length === 0 && (
              <p className="text-center text-xs text-[#4C5266] py-4">No matches found.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
