import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pushEventToFamily, pushEventDeleteToFamily } from "@/lib/google/sync";
import type { KinlockEvent } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title;
  if (body.startsAt !== undefined) updates.starts_at = body.startsAt;
  if (body.endsAt !== undefined) updates.ends_at = body.endsAt || null;
  if (body.isAllDay !== undefined) updates.is_all_day = body.isAllDay;
  if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo || null;
  if (body.location !== undefined) updates.location = body.location || null;
  if (body.notes !== undefined) updates.notes = body.notes || null;

  // RLS (events_update_editor_or_admin) blocks Viewers — a Viewer's
  // PATCH request simply matches zero rows and comes back empty below.
  const { data, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "You don't have permission to edit this event." },
      { status: 403 }
    );
  }

  try {
    await pushEventToFamily(createServiceClient(), data as KinlockEvent, data.family_id);
  } catch (err) {
    console.error("Google push failed for updated event:", err);
  }

  return NextResponse.json({ event: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "You don't have permission to delete this event." },
      { status: 403 }
    );
  }

  try {
    await pushEventDeleteToFamily(createServiceClient(), id, data.family_id);
  } catch (err) {
    console.error("Google delete-push failed:", err);
  }

  return NextResponse.json({ deleted: true });
}
