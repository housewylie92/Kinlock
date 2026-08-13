import type { KinlockEvent } from "@/lib/types";

const BASE = "https://www.googleapis.com/calendar/v3";

async function googleFetch(
  accessToken: string,
  path: string,
  init?: RequestInit
) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  return res;
}

/** Creates the dedicated secondary calendar events get mirrored into. */
export async function createKinlockCalendar(
  accessToken: string,
  familyName: string
): Promise<string> {
  const res = await googleFetch(accessToken, "/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: `Kinlock — ${familyName}` }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create Google calendar: ${await res.text()}`);
  }
  const data = await res.json();
  return data.id as string;
}

type GoogleEventBody = {
  summary: string;
  location?: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  extendedProperties: { private: { kinlockEventId: string } };
};

function toGoogleEventBody(event: KinlockEvent): GoogleEventBody {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : start;

  return {
    summary: event.title,
    location: event.location ?? undefined,
    description: event.notes ?? undefined,
    start: event.is_all_day
      ? { date: start.toISOString().slice(0, 10) }
      : { dateTime: start.toISOString() },
    end: event.is_all_day
      ? { date: end.toISOString().slice(0, 10) }
      : { dateTime: end.toISOString() },
    extendedProperties: { private: { kinlockEventId: event.id } },
  };
}

export async function insertGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: KinlockEvent
): Promise<string> {
  const res = await googleFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(toGoogleEventBody(event)) }
  );
  if (!res.ok) {
    throw new Error(`Failed to create Google event: ${await res.text()}`);
  }
  const data = await res.json();
  return data.id as string;
}

export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string,
  event: KinlockEvent
): Promise<void> {
  const res = await googleFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
    { method: "PUT", body: JSON.stringify(toGoogleEventBody(event)) }
  );
  // 404/410 means it no longer exists on Google's side — treat as
  // non-fatal so a stale link doesn't block the rest of a sync pass.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Failed to update Google event: ${await res.text()}`);
  }
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string
): Promise<void> {
  const res = await googleFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Failed to delete Google event: ${await res.text()}`);
  }
}

export type GoogleListedEvent = {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  location?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  updated?: string;
  extendedProperties?: { private?: { kinlockEventId?: string } };
};

export type IncrementalListResult = {
  events: GoogleListedEvent[];
  nextSyncToken: string | null;
  /** True if Google rejected the syncToken (410) and a full resync is needed. */
  needsFullResync: boolean;
};

/**
 * Lists changes since `syncToken` (Google's incremental sync cursor).
 * Pass no syncToken for the first sync — this pulls the full history.
 * If Google returns 410 (token expired/invalid, which happens after
 * long gaps between syncs), the caller should retry with no syncToken.
 */
export async function listEventsIncremental(
  accessToken: string,
  calendarId: string,
  syncToken?: string | null
): Promise<IncrementalListResult> {
  const events: GoogleListedEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const params = new URLSearchParams({ showDeleted: "true", singleEvents: "true" });
    if (syncToken) params.set("syncToken", syncToken);
    if (pageToken) params.set("pageToken", pageToken);
    if (!syncToken) params.set("timeMin", new Date().toISOString()); // bound the first full sync to "now onward"

    const res = await googleFetch(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
    );

    if (res.status === 410) {
      return { events: [], nextSyncToken: null, needsFullResync: true };
    }
    if (!res.ok) {
      throw new Error(`Failed to list Google events: ${await res.text()}`);
    }

    const data = await res.json();
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken, needsFullResync: false };
}
