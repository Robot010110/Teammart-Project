import { useEffect, useState } from "react";
import { Check, Loader2, KeyRound, Lock } from "lucide-react";
import Modal from "../common/Modal";
import { getProfile, updateMyUserId, updateMyPassword } from "../../services/profileService";
import { useAsync } from "../../hooks/useAsync";
import { ApiError } from "../../services/apiClient";

// Which field on the profile response is this account's own "User ID"
// (spec §7/§9), by kind/role. A Cashier's employeeCode exists too but
// username is what they actually log in with, so that's the one exposed
// here — same reasoning in reverse for a Worker.
function userIdField(profile) {
  if (profile.kind === "staff") return "loginId";
  if (profile.role === "CASHIER") return "username";
  return "employeeCode";
}

// SecuritySettingsModal.jsx — spec §7-8: change your own User ID and/or
// password, from Settings → Security. Works for every account kind
// (Worker/Cashier/Supervisor/Overlooking/Regional Manager/Admin) through
// the same two backend endpoints (PATCH /api/profile, PATCH
// /api/profile/password) — ownership is enforced server-side (always the
// caller's own row), never by anything in this modal.
export default function SecuritySettingsModal({ onClose }) {
  const { data: profile, error: profileError, loading: profileLoading } = useAsync(getProfile, { deps: [] });

  const [userIdDraft, setUserIdDraft] = useState("");
  const [savingUserId, setSavingUserId] = useState(false);
  const [userIdError, setUserIdError] = useState(null);
  const [userIdSaved, setUserIdSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (profile) setUserIdDraft(profile[userIdField(profile)] ?? "");
  }, [profile]);

  async function handleSaveUserId() {
    const field = userIdField(profile);
    const trimmed = userIdDraft.trim();
    if (!trimmed || trimmed === profile[field]) return;
    setSavingUserId(true);
    setUserIdError(null);
    setUserIdSaved(false);
    try {
      await updateMyUserId(field, trimmed);
      setUserIdSaved(true);
    } catch (err) {
      setUserIdError(err instanceof ApiError ? err.message : "Could not update your User ID.");
    } finally {
      setSavingUserId(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSaved(false);
    if (!currentPassword || !newPassword) {
      setPasswordError("Fill in both your current and new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }
    setSavingPassword(true);
    try {
      await updateMyPassword(currentPassword, newPassword);
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Could not change your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  const inputClass =
    "w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-base sm:text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50";

  return (
    <Modal open onClose={onClose} title="Security">
      {profileLoading ? (
        <p className="text-sm text-[#4C5266] text-center py-6">Loading...</p>
      ) : profileError ? (
        <p className="text-sm text-red-400 text-center py-6">{profileError}</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white mb-2">
              <KeyRound size={14} className="text-[#F47A20]" /> User ID
            </h3>
            <p className="text-xs text-[#8B93A8] mb-2">Not case-sensitive when logging in — em881 and EM881 both work.</p>
            <input
              value={userIdDraft}
              onChange={(e) => { setUserIdDraft(e.target.value); setUserIdSaved(false); }}
              placeholder="Not assigned yet"
              className={inputClass}
            />
            {userIdError && <p className="mt-1.5 text-xs text-red-400">{userIdError}</p>}
            {userIdSaved && <p className="mt-1.5 text-xs text-emerald-400">User ID updated — use it next time you log in.</p>}
            <button
              type="button"
              onClick={handleSaveUserId}
              disabled={savingUserId || !userIdDraft.trim() || userIdDraft.trim() === profile[userIdField(profile)]}
              className="mt-2 flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-150"
            >
              {savingUserId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save User ID
            </button>
          </div>

          <div className="pt-5 border-t border-white/[0.06]">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white mb-2">
              <Lock size={14} className="text-[#F47A20]" /> Change Password
            </h3>
            <div className="space-y-2.5">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                className={inputClass}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                autoComplete="new-password"
                className={inputClass}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
            {passwordError && <p className="mt-1.5 text-xs text-red-400">{passwordError}</p>}
            {passwordSaved && <p className="mt-1.5 text-xs text-emerald-400">Password changed — use it next time you log in.</p>}
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPassword}
              className="mt-2 flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-150"
            >
              {savingPassword ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Change Password
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
