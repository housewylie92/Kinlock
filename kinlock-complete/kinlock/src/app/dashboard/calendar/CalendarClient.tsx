"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import type { FamilyMember, KinlockEvent } from "@/lib/types";
import { EventModal } from "./EventModal";
import { QuickAddModal } from "./QuickAddModal";
import { UpcomingList } from "./UpcomingList";
import { useBrowserReminders, requestReminderPermission } from "./useBrowserReminders";

type View = "month" | "week";

export function CalendarClient({
  familyId,
  familyName,
  roster,
  currentUserId,
  canEdit,
}: {
  familyId: string;
  familyName: string;
  roster: FamilyMember[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<KinlockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<
    | { mode: "create"; date: Date }
    | { mode: "edit"; event: KinlockEvent }
    | null
  >(null);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setRemindersEnabled(Notification.permission === "granted");
    }
  }, []);

  const memberById = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    roster.forEach((m) => map.set(m.id, m));
    return map;
  }, [roster]);

  const { rangeStart, rangeEnd, days } = useMemo(() => {
    if (view === "month") {
      const monthStart = startOfMonth(anchor);
      const monthEnd = endOfMonth(anchor);
      const gridStart = startOfWeek(monthStart);
      const gridEnd = endOfWeek(monthEnd);
      return {
        rangeStart: gridStart,
        rangeEnd: gridEnd,
        days: eachDayOfInterval({ start: gridStart, end: gridEnd }),
      };
    }
    const weekStart = startOfWeek(anchor);
    const weekEnd = endOfWeek(anchor);
    return {
      rangeStart: weekStart,
      rangeEnd: weekEnd,
      days: eachDayOfInterval({ start: weekStart, end: weekEnd }),
    };
  }, [anchor, view]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      familyId,
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
    });
    const res = await fetch(`/api/events?${params}`);
    const body = await res.json();
    if (res.ok) setEvents(body.events);
    setLoading(false);
  }, [familyId, rangeStart, rangeEnd]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Best-effort foreground reminders — real push notifications (working
  // when the app is closed) are a Phase 3+ item that needs a service
  // worker and a backend push service.
  useBrowserReminders(events, familyName);

  function eventsOnDay(day: Date) {
    return events
      .filter((e) => isSameDay(new Date(e.starts_at), day))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  function colorFor(event: KinlockEvent) {
    if (!event.assigned_to) return "var(--indigo)";
    return memberById.get(event.assigned_to)?.avatar_color ?? "var(--indigo)";
  }

  function goToday() {
    setAnchor(new Date());
  }
  function goPrev() {
    setAnchor((d) => (view === "month" ? addMonths(d, -1) : addWeeks(d, -1)));
  }
  function goNext() {
    setAnchor((d) => (view === "month" ? addMonths(d, 1) : addWeeks(d, 1)));
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl text-ink">
            {format(anchor, view === "month" ? "MMMM yyyy" : "'Week of' MMM d")}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              aria-label="Previous"
              className="rounded-md border border-mist px-2.5 py-1 text-ink/60 hover:bg-mist/40"
            >
              ‹
            </button>
            <button
              onClick={goToday}
              className="rounded-md border border-mist px-2.5 py-1 text-sm text-ink/60 hover:bg-mist/40"
            >
              Today
            </button>
            <button
              onClick={goNext}
              aria-label="Next"
              className="rounded-md border border-mist px-2.5 py-1 text-ink/60 hover:bg-mist/40"
            >
              ›
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-mist p-0.5">
            {(["month", "week"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-sm capitalize transition ${
                  view === v ? "bg-indigo text-paper" : "text-ink/60"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {canEdit && (
            <>
              <button
                onClick={() => setModalState({ mode: "create", date: new Date() })}
                className="rounded-lg bg-gold px-3.5 py-1.5 text-sm font-medium text-ink transition hover:brightness-95"
              >
                + Add event
              </button>
              <button
                onClick={() => setQuickAddOpen(true)}
                className="rounded-lg bg-indigo px-3.5 py-1.5 text-sm font-medium text-paper transition hover:bg-indigo-dark"
              >
                ✨ AI Quick-Add
              </button>
            </>
          )}
          {!remindersEnabled && (
            <button
              onClick={async () => {
                const permission = await requestReminderPermission();
                setRemindersEnabled(permission === "granted");
              }}
              className="rounded-lg border border-mist px-3 py-1.5 text-sm text-ink/60 hover:bg-mist/40"
            >
              Enable reminders
            </button>
          )}
        </div>
      </div>

      <UpcomingList events={events} roster={roster} onSelect={(e) => setModalState({ mode: "edit", event: e })} />

      {!canEdit && (
        <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink/40">
          View only — ask an admin for editor access to add events
        </p>
      )}

      {view === "month" ? (
        <div className="overflow-hidden rounded-xl border border-mist bg-white">
          <div className="grid grid-cols-7 border-b border-mist bg-mist/20">
            {days.slice(0, 7).map((d) => (
              <div
                key={d.toISOString()}
                className="px-2 py-2 text-center font-mono text-[11px] uppercase tracking-wide text-ink/50"
              >
                {format(d, "EEE")}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayEvents = eventsOnDay(day);
              const dimmed = !isSameMonth(day, anchor);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() =>
                    canEdit && setModalState({ mode: "create", date: day })
                  }
                  className={`min-h-[92px] border-b border-r border-mist p-1.5 text-left align-top last:border-r-0 [&:nth-child(7n)]:border-r-0 hover:bg-mist/10 ${
                    dimmed ? "bg-mist/5" : ""
                  }`}
                >
                  <span
                    className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      isToday(day)
                        ? "bg-indigo text-paper"
                        : dimmed
                          ? "text-ink/30"
                          : "text-ink/70"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setModalState({ mode: "edit", event: e });
                        }}
                        className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                        style={{ backgroundColor: colorFor(e) }}
                      >
                        {e.is_all_day ? "" : format(new Date(e.starts_at), "h:mma ") }
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="px-1.5 text-[11px] text-ink/40">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day) => {
            const dayEvents = eventsOnDay(day);
            return (
              <div
                key={day.toISOString()}
                className="rounded-xl border border-mist bg-white p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-ink/50">
                    {format(day, "EEE d")}
                  </span>
                  {isToday(day) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo" />
                  )}
                </div>
                <div className="space-y-1.5">
                  {dayEvents.length === 0 && (
                    <p className="text-xs text-ink/30">No events</p>
                  )}
                  {dayEvents.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setModalState({ mode: "edit", event: e })}
                      className="block w-full truncate rounded-md px-2 py-1 text-left text-xs font-medium text-white"
                      style={{ backgroundColor: colorFor(e) }}
                    >
                      {e.is_all_day ? "All day · " : format(new Date(e.starts_at), "h:mma · ")}
                      {e.title}
                    </button>
                  ))}
                  {canEdit && (
                    <button
                      onClick={() => setModalState({ mode: "create", date: day })}
                      className="w-full rounded-md border border-dashed border-mist py-1 text-xs text-ink/40 hover:border-indigo hover:text-indigo"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <p className="mt-3 font-mono text-xs text-ink/30">Loading events…</p>
      )}

      {modalState && (
        <EventModal
          state={modalState}
          familyId={familyId}
          roster={roster}
          canEdit={canEdit}
          currentUserId={currentUserId}
          onClose={() => setModalState(null)}
          onSaved={() => {
            setModalState(null);
            loadEvents();
          }}
        />
      )}

      {quickAddOpen && (
        <QuickAddModal
          familyId={familyId}
          roster={roster}
          onClose={() => setQuickAddOpen(false)}
          onSaved={() => {
            setQuickAddOpen(false);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}
