import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InterlockMark } from "@/components/InterlockMark";
import { RoleBadge } from "@/components/RoleBadge";
import { InviteForm } from "./InviteForm";
import { SignOutButton } from "./SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Phase 1 assumes one family per user — multi-family switching is v2.
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

  const { data: roster } = await supabase
    .from("family_members")
    .select("role, joined_at, profiles(id, display_name, avatar_color)")
    .eq("family_id", membership.family_id);

  const canInvite = membership.role === "admin" || membership.role === "editor";

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-mist bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <InterlockMark size={30} />
            <span className="font-display text-lg text-ink">Kinlock</span>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-teal mb-2">
              Family
            </p>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl text-ink">{family?.name}</h1>
              <RoleBadge role={membership.role} />
            </div>
          </div>
          <Link
            href="/dashboard/calendar"
            className="rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-paper transition hover:bg-indigo-dark"
          >
            Open calendar →
          </Link>
        </div>

        <section className="mb-8 rounded-xl border border-mist bg-white p-6">
          <h2 className="font-display text-lg text-ink mb-4">Members</h2>
          <ul className="divide-y divide-mist">
            {roster?.map((m) => {
              const profile = Array.isArray(m.profiles)
                ? m.profiles[0]
                : m.profiles;
              return (
                <li
                  key={profile?.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full font-medium text-white text-sm"
                      style={{ backgroundColor: profile?.avatar_color }}
                    >
                      {profile?.display_name?.[0]?.toUpperCase()}
                    </span>
                    <span className="text-ink">{profile?.display_name}</span>
                  </div>
                  <RoleBadge role={m.role} />
                </li>
              );
            })}
          </ul>
        </section>

        {canInvite && <InviteForm familyId={membership.family_id} />}

        <p className="mt-10 text-sm text-ink/40">
          Two-way Google Calendar sync and AI Quick-Add land in Phase 3 &amp;
          4 — the calendar itself is live now.
        </p>
      </main>
    </div>
  );
}
