import { useEffect, useRef } from "react";
import type { KinlockEvent } from "@/lib/types";

const REMINDER_WINDOW_MINUTES = 15;
const CHECK_INTERVAL_MS = 60_000;

/**
 * Foreground-only reminders: if the browser tab is open and the user has
 * granted Notification permission, this fires a native notification once
 * per event when it's within REMINDER_WINDOW_MINUTES of starting.
 *
 * This is NOT push notifications — it does nothing if the tab is closed.
 * True background push needs a service worker + VAPID keys + a server
 * that can wake the browser, which is a Phase 3+ item once the app has
 * real hosting infrastructure to run that from.
 */
export function useBrowserReminders(events: KinlockEvent[], familyName: string) {
  const notifiedIds = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    function checkEvents() {
      if (Notification.permission !== "granted") return;
      const now = new Date();

      for (const event of events) {
        if (notifiedIds.current.has(event.id) || event.is_all_day) continue;
        const start = new Date(event.starts_at);
        const minutesUntil = (start.getTime() - now.getTime()) / 60_000;

        if (minutesUntil > 0 && minutesUntil <= REMINDER_WINDOW_MINUTES) {
          new Notification(event.title, {
            body: `${familyName} · starting soon${event.location ? ` at ${event.location}` : ""}`,
            tag: event.id,
          });
          notifiedIds.current.add(event.id);
        }
      }
    }

    checkEvents();
    const interval = setInterval(checkEvents, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [events, familyName]);
}

export function requestReminderPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    return Notification.requestPermission();
  }
  return Promise.resolve("denied" as NotificationPermission);
}
