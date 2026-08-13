import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl } from "@/lib/google/oauth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL));
  }

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.redirect(new URL("/onboarding", process.env.NEXT_PUBLIC_SITE_URL));
  }

  // CSRF protection: a random value that has to match what comes back
  // from Google, carried in an httpOnly cookie rather than trusting the
  // redirect alone. We also fold the family_id into the state itself so
  // the callback knows which family to attach the connection to.
  const csrf = randomUUID();
  const state = `${csrf}.${membership.family_id}`;

  const cookieStore = await cookies();
  cookieStore.set("kinlock_google_oauth_state", csrf, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — plenty for a consent-screen round trip
    path: "/",
  });

  return NextResponse.redirect(getGoogleAuthUrl(state));
}
