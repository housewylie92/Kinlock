import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pushEventToFamily } from "@/lib/google/sync";
import type { KinlockEvent } from "@/lib/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const familyId = searchParams.get("familyId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!familyId || !from || !to) {
    return NextResponse.json(
      { error: "familyId, from, and to are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, ends_at, is_all_day, location, notes, assigned_to, source, created_by"
    )
    .eq("family_id", familyId)
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ events: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json();
  const { familyId, title, startsAt, endsAt, isAllDay, assignedTo, location, notes } =
    body;

  if (!familyId || !title || !startsAt) {
    return NextResponse.json(
      { error: "familyId, title, and startsAt are required." },
      { status: 400 }
    );
  }

  // RLS (events_insert_editor_or_admin) blocks Viewers here — this
  // isn't a permission check we need to duplicate in application code.
  const { data, error } = await supabase
    .from("events")
    .insert({
      family_id: familyId,
      title,
      starts_at: startsAt,
      ends_at: endsAt || null,
      is_all_day: !!isAllDay,
      assigned_to: assignedTo || null,
      location: location || null,
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Push to any connected family members' Google calendars. Sync
  // failures shouldn't fail the event creation itself — the event is
  // already saved in Kinlock, and the next cron pull/push will catch up.
  try {
    await pushEventToFamily(createServiceClient(), data as KinlockEvent, familyId);
  } catch (err) {
    console.error("Google push failed for new event:", err);
  }

  return NextResponse.json({ event: data });
}
