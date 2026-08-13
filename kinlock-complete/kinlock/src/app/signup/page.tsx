"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Field, PrimaryButton, ErrorText } from "@/components/form";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/onboarding";

  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If email confirmations are on, there's no session yet.
    if (!data.session) {
      setCheckEmail(true);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  if (checkEmail) {
    return (
      <>
        <h2 className="font-display text-2xl text-ink mb-3">
          Check your inbox
        </h2>
        <p className="text-ink/70 leading-relaxed">
          We sent a confirmation link to <strong>{email}</strong>. Once
          you&rsquo;ve confirmed, come back and sign in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block font-medium text-indigo hover:underline"
        >
          Go to sign in →
        </Link>
      </>
    );
  }

  return (
    <>
      <h2 className="font-display text-2xl text-ink mb-6">
        Create your account
      </h2>

      <form onSubmit={handleSubmit}>
        <ErrorText>{error}</ErrorText>
        <Field
          label="Your name"
          type="text"
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PrimaryButton type="submit" loading={loading}>
          Create account
        </PrimaryButton>
      </form>

      <p className="mt-6 text-sm text-ink/60">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function SignupPage() {
  return (
    <AuthLayout eyebrow="Get started">
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthLayout>
  );
}
