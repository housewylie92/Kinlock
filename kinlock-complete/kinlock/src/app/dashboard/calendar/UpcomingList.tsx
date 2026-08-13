"use client";

import { useMemo } from "react";
import { format, isTomorrow, isToday, differenceInHours } from "date-fns";
import type { FamilyMember, KinlockEvent } from "@/lib/types";

export function UpcomingList({
  events,
  roster,
  onSelect,
}: {
  events: KinlockEvent[];
  roster: FamilyMember[];
  onSelect: (event: KinlockEvent) => void;
}) {
  const memberById = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    roster.forEach((m) => map.set(m.id, m));
    return map;
  }, [roster]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => {
        const start = new Date(e.starts_at);
        return start >= now && differenceInHours(start, now) <= 48;
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, 5);
  }, [events]);

  if (upcoming.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-mist bg-white p-4">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-teal">
        Coming up
      </p>
      <div className="flex flex-wrap gap-2">
        {upcoming.map((e) => {
          const start = new Date(e.starts_at);
          const member = e.assigned_to ? memberById.get(e.assigned_to) : null;
          const when = e.is_all_day
            ? isToday(start)
              ? "Today"
              : isTomorrow(start)
                ? "Tomorrow"
                : format(start, "EEE")
            : `${isToday(start) ? "Today" : isTomorrow(start) ? "Tomorrow" : format(start, "EEE")} · ${format(start, "h:mma")}`;

          return (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className="flex items-center gap-2 rounded-full border border-mist bg-paper px-3 py-1.5 text-sm transition hover:border-indigo/40"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: member?.avatar_color ?? "var(--indigo)",
                }}
              />
              <span className="font-medium text-ink">{e.title}</span>
              <span className="text-ink/40">{when}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
