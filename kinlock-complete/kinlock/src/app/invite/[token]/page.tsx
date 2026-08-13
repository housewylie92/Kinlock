import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthLayout } from "@/components/AuthLayout";
import { AcceptInviteButton } from "./AcceptInviteButton";

type InvitePreview = {
  family_name: string;
  role: "admin" | "editor" | "viewer";
  invited_email: string;
  is_expired: boolean;
  is_used: boolean;
};

const ROLE_COPY: Record<string, string> = {
  admin: "an Admin — full control over the family, members, and settings",
  editor: "an Editor — can add and manage events for the family",
  viewer: "a Viewer — can see the family calendar",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: preview, error } = await supabase
    .rpc("get_invite_preview", { invite_token: token })
    .single<InvitePreview>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (error || !preview) {
    return (
      <AuthLayout eyebrow="Invite">
        <h2 className="font-display text-2xl text-ink mb-2">
          Invite not found
        </h2>
        <p className="text-ink/60">
          This link may be mistyped. Ask whoever invited you to send a new
          one.
        </p>
      </AuthLayout>
    );
  }

  if (preview.is_used) {
    return (
      <AuthLayout eyebrow="Invite">
        <h2 className="font-display text-2xl text-ink mb-2">
          Already accepted
        </h2>
        <p className="text-ink/60 mb-6">
          This invite has already been used.{" "}
          {user ? (
            <Link href="/dashboard" className="text-indigo hover:underline">
              Go to your dashboard →
            </Link>
          ) : (
            <Link href="/login" className="text-indigo hover:underline">
              Sign in →
            </Link>
          )}
        </p>
      </AuthLayout>
    );
  }

  if (preview.is_expired) {
    return (
      <AuthLayout eyebrow="Invite">
        <h2 className="font-display text-2xl text-ink mb-2">Link expired</h2>
        <p className="text-ink/60">
          This invite link has expired. Ask an admin on{" "}
          <strong>{preview.family_name}</strong> to send you a new one.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="You're invited">
      <h2 className="font-display text-2xl text-ink mb-2">
        Join {preview.family_name}
      </h2>
      <p className="text-ink/60 mb-8 leading-relaxed">
        You&rsquo;ve been invited to join as {ROLE_COPY[preview.role]}.
      </p>

      {user ? (
        <AcceptInviteButton token={token} />
      ) : (
        <div className="space-y-3">
          <Link
            href={`/signup?redirect=${encodeURIComponent(`/invite/${token}`)}`}
            className="block w-full rounded-lg bg-indigo px-4 py-2.5 text-center font-medium text-paper transition hover:bg-indigo-dark"
          >
            Create an account to join
          </Link>
          <Link
            href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
            className="block w-full rounded-lg border border-mist px-4 py-2.5 text-center font-medium text-ink transition hover:bg-mist/40"
          >
            I already have an account
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
