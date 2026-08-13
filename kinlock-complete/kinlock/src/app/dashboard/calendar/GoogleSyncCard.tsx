"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

export function GoogleSyncCard({
  connected,
  lastSyncedAt,
  message,
}: {
  connected: boolean;
  lastSyncedAt: string | null;
  message?: { type: "success" | "error"; text: string };
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSyncNow() {
    setSyncing(true);
    setError(null);
    const res = await fetch("/api/sync/google", { method: "POST" });
    const body = await res.json();
    setSyncing(false);
    if (!res.ok) {
      setError(body.error ?? "Sync failed.");
      return;
    }
    router.refresh();
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Google Calendar? Your synced calendar in Google stays as-is, but Kinlock will stop updating it.")) {
      return;
    }
    setDisconnecting(true);
    await fetch("/api/google/disconnect", { method: "POST" });
    setDisconnecting(false);
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-xl border border-mist bg-white p-4">
      {message && (
        <p
          className={`mb-3 rounded-lg px-3 py-2 text-sm ${
            message.type === "success"
              ? "bg-teal/10 text-teal"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-teal mb-1">
            Google Calendar
          </p>
          {connected ? (
            <p className="text-sm text-ink/60">
              Connected · syncs both ways with your{" "}
              <span className="font-medium text-ink">Kinlock — Family</span>{" "}
              calendar in Google
              {lastSyncedAt && (
                <> · last synced {formatDistanceToNow(new Date(lastSyncedAt))} ago</>
              )}
            </p>
          ) : (
            <p className="text-sm text-ink/60">
              Not connected — events stay in Kinlock only
            </p>
          )}
        </div>

        {connected ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="rounded-lg border border-mist px-3 py-1.5 text-sm text-ink/70 transition hover:bg-mist/40 disabled:opacity-60"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg px-3 py-1.5 text-sm text-ink/40 transition hover:text-red-600"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <a
            href="/api/google/connect"
            className="rounded-lg bg-indigo px-3.5 py-1.5 text-sm font-medium text-paper transition hover:bg-indigo-dark"
          >
            Connect Google Calendar
          </a>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
