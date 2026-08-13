"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { FamilyMember } from "@/lib/types";
import { ErrorText } from "@/components/form";

type DraftEvent = {
  key: string;
  title: string;
  starts_at: string; // datetime-local string
  is_all_day: boolean;
  assigned_to_id: string | null;
  location: string;
  notes: string;
  needs_review: boolean;
};

function toLocalInputValue(iso: string, isAllDay: boolean) {
  const d = new Date(iso);
  if (isAllDay) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuickAddModal({
  familyId,
  roster,
  onClose,
  onSaved,
}: {
  familyId: string;
  roster: FamilyMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<DraftEvent[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    setParsing(true);
    setError(null);

    const res = await fetch("/api/ai/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId, text }),
    });
    const body = await res.json();

    setParsing(false);

    if (!res.ok) {
      setError(body.error ?? "Couldn't parse that.");
      return;
    }

    setDrafts(
      body.events.map(
        (
          e: {
            title: string;
            starts_at: string;
            is_all_day: boolean;
            assigned_to_id: string | null;
            location: string;
            notes: string;
            needs_review: boolean;
          },
          i: number
        ) => ({
          key: `${i}-${Date.now()}`,
          title: e.title,
          starts_at: toLocalInputValue(e.starts_at, e.is_all_day),
          is_all_day: e.is_all_day,
          assigned_to_id: e.assigned_to_id,
          location: e.location,
          notes: e.notes,
          needs_review: e.needs_review,
        })
      )
    );
  }

  function updateDraft(key: string, patch: Partial<DraftEvent>) {
    setDrafts((prev) =>
      prev ? prev.map((d) => (d.key === key ? { ...d, ...patch } : d)) : prev
    );
  }

  function removeDraft(key: string) {
    setDrafts((prev) => (prev ? prev.filter((d) => d.key !== key) : prev));
  }

  async function handleSaveAll() {
    if (!drafts || drafts.length === 0) return;
    setSaving(true);
    setError(null);

    for (const d of drafts) {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyId,
          title: d.title,
          startsAt: new Date(d.starts_at).toISOString(),
          isAllDay: d.is_all_day,
          assignedTo: d.assigned_to_id,
          location: d.location,
          notes: d.notes,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(`Saved some events, but hit an error on "${d.title}": ${body.error}`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">AI Quick-Add</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink/40 hover:text-ink">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-ink/60">
          Paste in whatever you&rsquo;ve got — a text thread, a school email, your own shorthand — and Kinlock will sort it into events.
        </p>

        <ErrorText>{error}</ErrorText>

        {!drafts && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={`e.g. "soccer practice Tues 4pm for Emma, dentist Thursday 2:30 for Jake, family dinner Friday 6pm"`}
              className="mb-4 w-full rounded-lg border border-mist bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/15"
            />
            <button
              onClick={handleParse}
              disabled={parsing || !text.trim()}
              className="w-full rounded-lg bg-indigo px-4 py-2.5 font-medium text-paper transition hover:bg-indigo-dark disabled:opacity-60"
            >
              {parsing ? "Reading through that…" : "Parse with AI"}
            </button>
          </>
        )}

        {drafts && (
          <>
            {drafts.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink/50">
                No events left to add.
              </p>
            ) : (
              <div className="mb-4 space-y-3">
                {drafts.map((d) => (
                  <div
                    key={d.key}
                    className={`rounded-lg border p-3 ${
                      d.needs_review ? "border-gold bg-gold/5" : "border-mist"
                    }`}
                  >
                    {d.needs_review && (
                      <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-gold">
                        Double-check this one
                      </p>
                    )}
                    <div className="mb-2 flex items-start gap-2">
                      <input
                        value={d.title}
                        onChange={(e) => updateDraft(d.key, { title: e.target.value })}
                        className="flex-1 rounded-md border border-mist px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-indigo"
                      />
                      <button
                        onClick={() => removeDraft(d.key)}
                        aria-label="Remove"
                        className="px-1 text-ink/30 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type={d.is_all_day ? "date" : "datetime-local"}
                        value={d.starts_at}
                        onChange={(e) => updateDraft(d.key, { starts_at: e.target.value })}
                        className="rounded-md border border-mist px-2.5 py-1.5 text-sm text-ink outline-none focus:border-indigo"
                      />
                      <select
                        value={d.assigned_to_id ?? ""}
                        onChange={(e) =>
                          updateDraft(d.key, { assigned_to_id: e.target.value || null })
                        }
                        className="rounded-md border border-mist px-2.5 py-1.5 text-sm text-ink outline-none focus:border-indigo"
                      >
                        <option value="">Whole family</option>
                        {roster.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDrafts(null)}
                className="flex-1 rounded-lg border border-mist px-4 py-2.5 font-medium text-ink/70 transition hover:bg-mist/40"
              >
                Back
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving || drafts.length === 0}
                className="flex-1 rounded-lg bg-indigo px-4 py-2.5 font-medium text-paper transition hover:bg-indigo-dark disabled:opacity-60"
              >
                {saving
                  ? "Adding…"
                  : `Add ${drafts.length} event${drafts.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
