import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { familyId, email, role } = await request.json();

  if (!familyId || !email) {
    return NextResponse.json(
      { error: "familyId and email are required." },
      { status: 400 }
    );
  }

  if (!["admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  // RLS (invites_insert_family) blocks this unless the caller is an
  // admin or editor on family_id — no extra check needed here.
  const { data, error } = await supabase
    .from("invites")
    .insert({
      family_id: familyId,
      email,
      role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // TODO (Phase 1.5): send the actual email via Resend/Postmark.
  // For now, return the shareable link for manual sending, so invite
  // flow is fully testable before email delivery is wired up.
  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${data.token}`;

  return NextResponse.json({ invite: data, inviteUrl });
}
