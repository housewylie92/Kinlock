import { InputHTMLAttributes, LabelHTMLAttributes, ButtonHTMLAttributes } from "react";

export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-4">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-mist bg-white px-3.5 py-2.5 text-ink placeholder:text-ink/35 outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/15"
      />
    </label>
  );
}

export function PrimaryButton({
  children,
  loading,
  ...props
}: {
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className="w-full rounded-lg bg-indigo px-4 py-2.5 font-medium text-paper transition hover:bg-indigo-dark disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      {loading ? "One moment…" : children}
    </button>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}
