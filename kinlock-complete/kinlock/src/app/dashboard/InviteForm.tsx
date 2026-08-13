"use client";

import { useState } from "react";
import { Field, PrimaryButton, ErrorText } from "@/components/form";

export function InviteForm({ familyId }: { familyId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInviteUrl(null);

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId, email, role }),
    });

    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Couldn't create that invite.");
      setLoading(false);
      return;
    }

    setInviteUrl(body.inviteUrl);
    setEmail("");
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-mist bg-white p-6">
      <h3 className="font-display text-lg text-ink mb-1">Invite someone</h3>
      <p className="text-sm text-ink/60 mb-4">
        They&rsquo;ll get a link — email delivery is next on the list, so for
        now, copy and send it yourself.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <Field
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <label className="block mb-4 sm:w-36">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Role
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-mist bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/15"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <div className="sm:w-36 mb-4">
          <PrimaryButton type="submit" loading={loading}>
            Send invite
          </PrimaryButton>
        </div>
      </form>

      <ErrorText>{error}</ErrorText>

      {inviteUrl && (
        <div className="rounded-lg bg-teal/10 px-3.5 py-3 text-sm">
          <p className="mb-1 text-ink/70">Invite link ready:</p>
          <code className="break-all font-mono text-xs text-teal">
            {inviteUrl}
          </code>
        </div>
      )}
    </div>
  );
}
