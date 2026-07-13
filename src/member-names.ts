export type MemberNameSource = {
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
};

function cleanName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function nameFromEmail(email: string | null | undefined) {
  const localPart = cleanName(email)?.split("@")[0];
  if (!localPart) return null;
  const words = localPart.split(/[._-]+/).filter(Boolean);
  if (!words.length) return null;
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function resolveMemberDisplayName(
  source: MemberNameSource | null | undefined,
) {
  return (
    cleanName(source?.displayName) ??
    cleanName(source?.fullName) ??
    nameFromEmail(source?.email) ??
    "Adventure Planner"
  );
}
