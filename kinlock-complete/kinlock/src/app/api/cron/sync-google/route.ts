import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pullChangesForConnection } from "@/lib/google/sync";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();
  const { data: connections } = await db.from("calendar_connections").select("*");

  const results = { succeeded: 0, failed: 0 };

  for (const connection of connections ?? []) {
    try {
      await pullChangesForConnection(db, connection);
      results.succeeded += 1;
    } catch (err) {
      // One family's broken token shouldn't stop everyone else's sync —
      // log and move on. (console.error surfaces in Vercel's function logs.)
      console.error(`Sync failed for connection ${connection.id}:`, err);
      results.failed += 1;
    }
  }

  return NextResponse.json(results);
}
