import { useState } from "react";
import { Camera, X, Loader2, Lock } from "lucide-react";
import Modal from "../common/Modal";
import { CATEGORY_LABELS } from "../../data/workspaceData";
import { canEditActivity } from "../../data/activityRules";
import {
  createActivity, updateActivity, addActivityImage, deleteActivityImage, prepareImageForUpload,
} from "../../services/activityService";
import { ApiError } from "../../services/apiClient";

// SubmitTaskModal.jsx — the form an employee fills out to log a daily
// activity (create) or edit one that's still Draft/Pending (edit). Same
// component handles both so the UI doesn't fork into two near-identical
// modals. Talks directly to activityService — POST /api/activities for a
// new activity, PATCH /api/activities/:id for edits.
//
// `option`   — set when creating: { category, label } from ACTIVITY_SUBMISSION_OPTIONS
// `activity` — set when editing: the existing Activity object from the backend
// Exactly one of the two is provided by the parent.
//
// Note on images: this component never encodes/decodes anything itself —
// it just calls prepareImageForUpload(file) from activityService and
// treats whatever comes back as an opaque "url" string to display and
// submit. See activityService.js for why that matters (Base64 today,
// swappable for a real upload later with no change here).

function formatTimeNow() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export default function SubmitTaskModal({ option, activity, onClose, onSaved }) {
  const isEdit = !!activity;
  const open = !!option || !!activity;

  const [notes, setNotes] = useState(activity?.notes || "");
  const [newImages, setNewImages] = useState([]); // [{ url, name }] — pending, not uploaded yet (create mode)
  const [existingImages, setExistingImages] = useState(activity?.images || []); // edit mode only
  const [submitting, setSubmitting] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const title = isEdit ? `Edit: ${CATEGORY_LABELS[activity.category] || activity.category}` : option.label;

  // Belt-and-suspenders: TaskStatusTabs only ever opens this modal for an
  // editable activity (see canEditActivity), but re-checking here means
  // this component is safe on its own — if it were ever reused somewhere
  // else, or a Supervisor-review update raced with the modal being open,
  // it fails closed with an explanation instead of quietly letting the
  // employee submit an edit the backend will reject anyway.
  if (isEdit && !canEditActivity(activity)) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Lock size={20} className="text-[#4C5266]" />
          <p className="text-sm text-[#9AA1B4]">
            This activity is already <span className="text-white font-medium">{activity.status.toLowerCase()}</span> and
            can no longer be edited.
          </p>
        </div>
      </Modal>
    );
  }

  const handleAddFiles = async (fileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setImageBusy(true);
    setError(null);
    try {
      if (isEdit) {
        // Edit mode: upload immediately so the image list on screen always
        // matches what's actually saved.
        for (const file of files) {
          const url = await prepareImageForUpload(file);
          const image = await addActivityImage(activity.id, url);
          setExistingImages((prev) => [...prev, image]);
        }
      } else {
        // Create mode: nothing to upload to yet (the activity doesn't
        // exist), so just hold the images in memory until Submit.
        const converted = await Promise.all(
          files.map(async (file) => ({ url: await prepareImageForUpload(file), name: file.name }))
        );
        setNewImages((prev) => [...prev, ...converted]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not attach that image. Please try again.");
    } finally {
      setImageBusy(false);
    }
  };

  const removeNewImage = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = async (imageId) => {
    setImageBusy(true);
    setError(null);
    try {
      await deleteActivityImage(activity.id, imageId);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that image. Please try again.");
    } finally {
      setImageBusy(false);
    }
  };

  const handleSubmit = async (submitForReview) => {
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        const patch = { notes };
        if (submitForReview && activity.status === "DRAFT") patch.status = "PENDING";
        const updated = await updateActivity(activity.id, patch);
        onSaved({ ...updated, images: existingImages }, "Activity updated.");
      } else {
        const created = await createActivity({
          category: option.category,
          date: new Date().toISOString(),
          time: formatTimeNow(),
          notes: notes || undefined,
          status: submitForReview ? "PENDING" : "DRAFT",
          imageUrls: newImages.map((img) => img.url),
        });
        onSaved(created, submitForReview ? "Activity submitted for review." : "Saved as draft.");
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this activity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || imageBusy;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything your supervisor should know..."
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-[#4C5266] outline-none focus:border-[#F47A20]/50 transition-colors duration-200 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-[#8B93A8] mb-1.5">Photos (optional)</label>
          <div className="flex flex-wrap gap-2">
            {existingImages.map((img) => (
              <div key={img.id} className="relative h-16 w-16 rounded-lg overflow-hidden ring-1 ring-white/10">
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingImage(img.id)}
                  disabled={busy}
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/70 grid place-items-center"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {newImages.map((img, i) => (
              <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden ring-1 ring-white/10">
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNewImage(i)}
                  disabled={busy}
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/70 grid place-items-center"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            <label
              className={`h-16 w-16 rounded-lg border grid place-items-center transition-colors duration-200 cursor-pointer ${
                busy ? "opacity-50 pointer-events-none" : "hover:border-[#F47A20]/40"
              } bg-gradient-to-br from-[#2A3050] to-[#181C2C] border-white/[0.06]`}
            >
              {imageBusy ? (
                <Loader2 size={16} className="text-[#4C5266] animate-spin" />
              ) : (
                <Camera size={16} className="text-[#4C5266]" />
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={(e) => { handleAddFiles(e.target.files); e.target.value = ""; }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          {(!isEdit || activity.status === "DRAFT") && (
            <button
              onClick={() => handleSubmit(false)}
              disabled={busy}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-[#9AA1B4] bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 transition-colors duration-200"
            >
              {isEdit ? "Save Draft" : "Save as Draft"}
            </button>
          )}
          <button
            onClick={() => handleSubmit(true)}
            disabled={busy}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:bg-white/10 disabled:text-[#4C5266] transition-colors duration-200 shadow-lg shadow-orange-900/20"
          >
            {submitting ? "Submitting..." : isEdit && activity.status === "PENDING" ? "Save Changes" : "Submit for Review"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
