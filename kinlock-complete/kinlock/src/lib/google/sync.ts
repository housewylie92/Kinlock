import type { SupabaseClient } from "@supabase/supabase-js";
import type { KinlockEvent } from "@/lib/types";
import { refreshAccessToken } from "./oauth";
import {
  insertGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  listEventsIncremental,
  type GoogleListedEvent,
} from "./calendar";

type Connection = {
  id: string;
  user_id: string;
  family_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  google_calendar_id: string;
  sync_token: string | null;
};

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

async function getValidAccessToken(
  db: SupabaseClient,
  connection: Connection
): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  if (Date.now() < expiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return connection.access_token;
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await db
    .from("calendar_connections")
    .update({ access_token: refreshed.access_token, token_expires_at: newExpiry })
    .eq("id", connection.id);

  return refreshed.access_token;
}

/**
 * Called right after a new connection is created: pushes every existing
 * family event into that member's freshly-created Kinlock calendar, so
 * connecting isn't a blank slate — it immediately shows the family's
 * current schedule.
 */
export async function backfillNewConnection(
  db: SupabaseClient,
  connection: Connection,
  events: KinlockEvent[]
) {
  const accessToken = await getValidAccessToken(db, connection);

  for (const event of events) {
    const googleEventId = await insertGoogleEvent(
      accessToken,
      connection.google_calendar_id,
      event
    );
    await db.from("event_google_links").upsert({
      event_id: event.id,
      connection_id: connection.id,
      google_event_id: googleEventId,
      updated_at: new Date().toISOString(),
    });
  }
}

/**
 * Push one event to every connection in its family except (optionally)
 * the one the change originated from. Used both after an app write and
 * after pulling a change from one member's Google calendar (to fan it
 * out to everyone else's).
 */
export async function pushEventToFamily(
  db: SupabaseClient,
  event: KinlockEvent,
  familyId: string,
  skipConnectionId?: string
) {
  const { data: connections } = await db
    .from("calendar_connections")
    .select("*")
    .eq("family_id", familyId);

  for (const connection of (connections ?? []) as Connection[]) {
    if (connection.id === skipConnectionId) continue;

    const accessToken = await getValidAccessToken(db, connection);

    const { data: link } = await db
      .from("event_google_links")
      .select("google_event_id")
      .eq("event_id", event.id)
      .eq("connection_id", connection.id)
      .maybeSingle();

    if (link) {
      await updateGoogleEvent(
        accessToken,
        connection.google_calendar_id,
        link.google_event_id,
        event
      );
    } else {
      const googleEventId = await insertGoogleEvent(
        accessToken,
        connection.google_calendar_id,
        event
      );
      await db.from("event_google_links").upsert({
        event_id: event.id,
        connection_id: connection.id,
        google_event_id: googleEventId,
        updated_at: new Date().toISOString(),
      });
    }
  }
}

/** Removes an event from every connected family member's Google calendar. */
export async function pushEventDeleteToFamily(
  db: SupabaseClient,
  eventId: string,
  familyId: string
) {
  const { data: connections } = await db
    .from("calendar_connections")
    .select("*")
    .eq("family_id", familyId);

  for (const connection of (connections ?? []) as Connection[]) {
    const { data: link } = await db
      .from("event_google_links")
      .select("google_event_id")
      .eq("event_id", eventId)
      .eq("connection_id", connection.id)
      .maybeSingle();

    if (!link) continue;

    const accessToken = await getValidAccessToken(db, connection);
    await deleteGoogleEvent(accessToken, connection.google_calendar_id, link.google_event_id);
    await db
      .from("event_google_links")
      .delete()
      .eq("event_id", eventId)
      .eq("connection_id", connection.id);
  }
}

function fromGoogleEvent(g: GoogleListedEvent) {
  const isAllDay = !!g.start?.date && !g.start?.dateTime;
  return {
    title: g.summary || "(untitled)",
    starts_at: new Date(g.start?.dateTime ?? g.start?.date ?? Date.now()).toISOString(),
    ends_at:
      g.end?.dateTime || g.end?.date
        ? new Date(g.end.dateTime ?? g.end.date!).toISOString()
        : null,
    is_all_day: isAllDay,
    location: g.location ?? null,
    notes: g.description ?? null,
  };
}

/**
 * Pulls changes since the connection's last sync. Policy:
 *  - Cancelled on Google  → unlink that member's mirror only (does NOT
 *    delete the shared Kinlock event or other members' copies — deleting
 *    a family event on purpose should happen in the app, where it's an
 *    explicit, visible action).
 *  - Known event, changed → update the shared Kinlock event and re-push
 *    to every OTHER connection so everyone stays in sync.
 *  - Unknown event        → someone added it directly in their "Kinlock"
 *    Google calendar. Create it in Kinlock and push it out to every
 *    OTHER connection — this is the actual two-way part Cozi never had.
 */
export async function pullChangesForConnection(
  db: SupabaseClient,
  connection: Connection
) {
  const accessToken = await getValidAccessToken(db, connection);

  let result = await listEventsIncremental(
    accessToken,
    connection.google_calendar_id,
    connection.sync_token
  );

  if (result.needsFullResync) {
    result = await listEventsIncremental(accessToken, connection.google_calendar_id, null);
  }

  for (const googleEvent of result.events) {
    // Look up by google_event_id — authoritative regardless of whether
    // the extendedProperty hint round-tripped correctly.
    const { data: link } = await db
      .from("event_google_links")
      .select("event_id")
      .eq("connection_id", connection.id)
      .eq("google_event_id", googleEvent.id)
      .maybeSingle();

    if (googleEvent.status === "cancelled") {
      if (link) {
        await db
          .from("event_google_links")
          .delete()
          .eq("event_id", link.event_id)
          .eq("connection_id", connection.id);
      }
      continue;
    }

    const fields = fromGoogleEvent(googleEvent);

    if (link) {
      const { data: updated } = await db
        .from("events")
        .update(fields)
        .eq("id", link.event_id)
        .select()
        .single();

      if (updated) {
        await pushEventToFamily(db, updated as KinlockEvent, connection.family_id, connection.id);
      }
    } else {
      const { data: created } = await db
        .from("events")
        .insert({
          family_id: connection.family_id,
          created_by: connection.user_id,
          source: "google_sync",
          ...fields,
        })
        .select()
        .single();

      if (created) {
        await db.from("event_google_links").insert({
          event_id: created.id,
          connection_id: connection.id,
          google_event_id: googleEvent.id,
        });
        await pushEventToFamily(db, created as KinlockEvent, connection.family_id, connection.id);
      }
    }
  }

  await db
    .from("calendar_connections")
    .update({
      sync_token: result.nextSyncToken,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", connection.id);
}
