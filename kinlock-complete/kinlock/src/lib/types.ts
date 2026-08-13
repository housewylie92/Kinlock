export type FamilyRole = "admin" | "editor" | "viewer";

export type FamilyMember = {
  id: string;
  display_name: string;
  avatar_color: string;
  role: FamilyRole;
};

export type KinlockEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  location: string | null;
  notes: string | null;
  assigned_to: string | null;
  source: "manual" | "ai_quick_add" | "google_sync";
  created_by: string;
};
