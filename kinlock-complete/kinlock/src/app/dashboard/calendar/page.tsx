import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InterlockMark } from "@/components/InterlockMark";
import { RoleBadge } from "@/components/RoleBadge";
import { SignOutButton } from "../SignOutButton";
import { CalendarClient } from "./CalendarClient";
import { GoogleSyncCard } from "./GoogleSyncCard";
import type { FamilyMember } from "@/lib/types";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; google_error?: string }>;
}) {
  const { google, google_error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("role, family_id, families(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const family = Array.isArray(membership.families)
    ? membership.families[0]
    : membership.families;

  const { data: rosterRows } = await supabase
    .from("family_members")
    .select("role, profiles(id, display_name, avatar_color)")
    .eq("family_id", membership.family_id);

  const roster: FamilyMember[] = (rosterRows ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: profile!.id,
      display_name: profile!.display_name,
      avatar_color: profile!.avatar_color,
      role: row.role,
    };
  });

  const canEdit = membership.role === "admin" || membership.role === "editor";

  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const message = google
    ? { type: "success" as const, text: google }
    : google_error
      ? { type: "error" as const, text: google_error }
      : undefined;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-mist bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <InterlockMark size={30} />
              <span className="font-display text-lg text-ink">Kinlock</span>
            </div>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-ink/60 hover:text-ink">
                Family
              </Link>
              <span className="font-medium text-indigo">Calendar</span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <RoleBadge role={membership.role} />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <GoogleSyncCard
          connected={!!connection}
          lastSyncedAt={connection?.last_synced_at ?? null}
          message={message}
        />
        <CalendarClient
          familyId={membership.family_id}
          familyName={family?.name ?? "Your family"}
          roster={roster}
          currentUserId={user.id}
          canEdit={canEdit}
        />
      </main>
    </div>
  );
}
