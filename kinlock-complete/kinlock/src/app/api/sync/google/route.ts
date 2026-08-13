import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pullChangesForConnection } from "@/lib/google/sync";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const db = createServiceClient();

  const { data: connection } = await db
    .from("calendar_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json(
      { error: "No Google Calendar connected." },
      { status: 400 }
    );
  }

  try {
    await pullChangesForConnection(db, connection);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ synced: true });
}
