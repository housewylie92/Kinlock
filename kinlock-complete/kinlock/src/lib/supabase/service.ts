import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Uses the Supabase SERVICE ROLE key, which bypasses Row Level Security.
 * Only ever import this in server-only code (API routes, cron jobs) —
 * never in a Client Component, and never send this key to the browser.
 *
 * Needed because sync has to run for events/connections belonging to
 * other users (e.g. a cron job syncing every family's Google connection,
 * or pushing an event to a family member's calendar who isn't the one
 * making the request).
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
