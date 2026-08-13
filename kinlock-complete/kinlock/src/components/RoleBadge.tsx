const STYLES: Record<string, string> = {
  admin: "bg-gold/15 text-gold border-gold/30",
  editor: "bg-teal/15 text-teal border-teal/30",
  viewer: "bg-indigo/10 text-indigo border-indigo/25",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide ${STYLES[role] ?? ""}`}
    >
      {role}
    </span>
  );
}
