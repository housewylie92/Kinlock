"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { FamilyMember, KinlockEvent } from "@/lib/types";
import { ErrorText } from "@/components/form";

type ModalState =
  | { mode: "create"; date: Date }
  | { mode: "edit"; event: KinlockEvent };

function toLocalInputValue(date: Date) {
  // datetime-local wants "yyyy-MM-ddTHH:mm" in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventModal({
  state,
  familyId,
  roster,
  canEdit,
  currentUserId,
  onClose,
  onSaved,
}: {
  state: ModalState;
  familyId: string;
  roster: FamilyMember[];
  canEdit: boolean;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = state.mode === "edit";
  const existing = isEdit ? state.event : null;

  const initialStart = isEdit
    ? new Date(state.event.starts_at)
    : (() => {
        const d = new Date(state.date);
        d.setHours(d.getHours() < 23 ? d.getHours() + 1 : 9, 0, 0, 0);
        return d;
      })();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInputValue(initialStart));
  const [isAllDay, setIsAllDay] = useState(existing?.is_all_day ?? false);
  const [assignedTo, setAssignedTo] = useState(existing?.assigned_to ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOnly = !canEdit;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      familyId,
      title,
      startsAt: new Date(startsAt).toISOString(),
      isAllDay,
      assignedTo: assignedTo || null,
      location,
      notes,
    };

    const res = await fetch(
      isEdit ? `/api/events/${existing!.id}` : "/api/events",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Couldn't save that event.");
      setLoading(false);
      return;
    }

    onSaved();
  }

  async function handleDelete() {
    if (!existing) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/events/${existing.id}`, {
      method: "DELETE",
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Couldn't delete that event.");
      setLoading(false);
      return;
    }

    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">
            {isEdit ? (readOnly ? "Event details" : "Edit event") : "New event"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink/40 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          <ErrorText>{error}</ErrorText>

          <label className="block mb-4">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Title
            </span>
            <input
              type="text"
              required
              disabled={readOnly}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-mist bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/15 disabled:bg-mist/20"
              placeholder="Soccer practice"
            />
          </label>

          <div className="mb-4 flex items-center gap-2">
            <input
              id="all-day"
              type="checkbox"
              disabled={readOnly}
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-mist accent-indigo"
            />
            <label htmlFor="all-day" className="text-sm text-ink">
              All day
            </label>
          </div>

          <label className="block mb-4">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              {isAllDay ? "Date" : "Date & time"}
            </span>
            <input
              type={isAllDay ? "date" : "datetime-local"}
              required
              disabled={readOnly}
              value={isAllDay ? startsAt.slice(0, 10) : startsAt}
              onChange={(e) =>
                setStartsAt(
                  isAllDay ? `${e.target.value}T00:00` : e.target.value
                )
              }
              className="w-full rounded-lg border border-mist bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/15 disabled:bg-mist/20"
            />
          </label>

          <label className="block mb-4">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Who&rsquo;s this for
            </span>
            <select
              disabled={readOnly}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-mist bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/15 disabled:bg-mist/20"
            >
              <option value="">Whole family</option>
              {roster.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block mb-4">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Location
            </span>
            <input
              type="text"
              disabled={readOnly}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-mist bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/15 disabled:bg-mist/20"
              placeholder="Optional"
            />
          </label>

          <label className="block mb-6">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Notes
            </span>
            <textarea
              disabled={readOnly}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-mist bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/15 disabled:bg-mist/20"
              placeholder="Optional"
            />
          </label>

          {!readOnly && (
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-indigo px-4 py-2.5 font-medium text-paper transition hover:bg-indigo-dark disabled:opacity-60"
              >
                {loading ? "Saving…" : isEdit ? "Save changes" : "Create event"}
              </button>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="rounded-lg border border-red-200 px-4 py-2.5 font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </form>

        {isEdit && existing?.source === "google_sync" && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-teal">
            Synced from Google Calendar
          </p>
        )}
      </div>
    </div>
  );
}
