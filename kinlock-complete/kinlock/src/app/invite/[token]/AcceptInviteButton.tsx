"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, ErrorText } from "@/components/form";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Couldn't accept this invite. Try again.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton onClick={handleAccept} loading={loading}>
        Accept and join
      </PrimaryButton>
    </div>
  );
}
