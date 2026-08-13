import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseQuickAdd } from "@/lib/ai/quickAdd";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { familyId, text } = await request.json();

  if (!familyId || !text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "familyId and text are required." },
      { status: 400 }
    );
  }

  // Check role before spending an API call — RLS would block the
  // eventual insert anyway, but there's no reason to pay for a Claude
  // call a Viewer can't act on.
  const { data: membership } = await supabase
    .from("family_members")
    .select("role")
    .eq("family_id", familyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || (membership.role !== "admin" && membership.role !== "editor")) {
    return NextResponse.json(
      { error: "You don't have permission to add events." },
      { status: 403 }
    );
  }

  const { data: roster } = await supabase
    .from("family_members")
    .select("profiles(id, display_name)")
    .eq("family_id", familyId);

  const rosterList = (roster ?? [])
    .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles))
    .filter((p): p is { id: string; display_name: string } => !!p);

  if (rosterList.length === 0) {
    return NextResponse.json({ error: "No family members found." }, { status: 400 });
  }

  try {
    const parsedEvents = await parseQuickAdd(
      text,
      rosterList.map((m) => m.display_name),
      new Date()
    );

    // Map the name Claude picked back to a real member id for the UI.
    const events = parsedEvents.map((e) => {
      const member = rosterList.find((m) => m.display_name === e.assigned_to);
      return { ...e, assigned_to_id: member?.id ?? null };
    });

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't parse that text." },
      { status: 500 }
    );
  }
}
