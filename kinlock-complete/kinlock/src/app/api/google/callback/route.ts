import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { createKinlockCalendar } from "@/lib/google/calendar";
import { backfillNewConnection } from "@/lib/google/sync";
import type { KinlockEvent } from "@/lib/types";

function redirectWithMessage(message: string, ok: boolean) {
  const url = new URL("/dashboard/calendar", process.env.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set(ok ? "google" : "google_error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirectWithMessage("You didn't complete the Google connection.", false);
  }
  if (!code || !state) {
    return redirectWithMessage("Something went wrong connecting Google.", false);
  }

  const [csrfFromState, familyId] = state.split(".");
  const cookieStore = await cookies();
  const csrfFromCookie = cookieStore.get("kinlock_google_oauth_state")?.value;
  cookieStore.delete("kinlock_google_oauth_state");

  if (!csrfFromCookie || csrfFromCookie !== csrfFromState) {
    return redirectWithMessage("That connection link expired — try again.", false);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL));

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch {
    return redirectWithMessage("Google didn't confirm the connection — try again.", false);
  }

  if (!tokens.refresh_token) {
    // Happens if the user previously connected, revoked, and Google
    // doesn't re-issue a refresh_token without `prompt=consent` — we
    // already force that, but this is a safety net with a clear message.
    return redirectWithMessage(
      "Google didn't grant lasting access — disconnect Kinlock in your Google Account permissions and try again.",
      false
    );
  }

  const db = createServiceClient();

  // Reuse an existing calendar if this user already connected this
  // family before (e.g. reconnecting after a token issue) rather than
  // creating a duplicate "Kinlock — Family" calendar every time.
  const { data: existing } = await db
    .from("calendar_connections")
    .select("google_calendar_id")
    .eq("user_id", user.id)
    .eq("family_id", familyId)
    .maybeSingle();

  let googleCalendarId = existing?.google_calendar_id;

  if (!googleCalendarId) {
    const { data: family } = await db
      .from("families")
      .select("name")
      .eq("id", familyId)
      .single();

    googleCalendarId = await createKinlockCalendar(
      tokens.access_token,
      family?.name ?? "Family"
    );
  }

  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { data: connection } = await db
    .from("calendar_connections")
    .upsert(
      {
        user_id: user.id,
        family_id: familyId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
        google_calendar_id: googleCalendarId,
        sync_token: null, // reset so the next sync does a fresh full pull
      },
      { onConflict: "user_id,family_id" }
    )
    .select()
    .single();

  if (!connection) {
    return redirectWithMessage("Couldn't save the connection — try again.", false);
  }

  // Only backfill on a brand-new calendar — reconnecting to an existing
  // one would otherwise duplicate every event that's already mirrored.
  if (!existing) {
    const { data: events } = await db
      .from("events")
      .select("*")
      .eq("family_id", familyId);

    if (events?.length) {
      await backfillNewConnection(db, connection, events as KinlockEvent[]);
    }
  }

  return redirectWithMessage("Google Calendar connected.", true);
}
