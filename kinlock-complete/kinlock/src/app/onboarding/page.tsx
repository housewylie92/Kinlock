"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Field, PrimaryButton, ErrorText } from "@/components/form";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthLayout eyebrow="One last step">
      <h2 className="font-display text-2xl text-ink mb-2">
        Name your family
      </h2>
      <p className="text-ink/60 mb-6 leading-relaxed">
        This is the shared space everyone you invite will land in. You&rsquo;ll
        be the admin — you can change that anytime.
      </p>

      <form onSubmit={handleSubmit}>
        <ErrorText>{error}</ErrorText>
        <Field
          label="Family name"
          type="text"
          placeholder="The Wylies"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <PrimaryButton type="submit" loading={loading}>
          Create family
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
}
