export type SchoolPortalRole = "chain_head" | "principal" | "teacher";

const SCHOOL_PORTAL_ROLES = new Set<SchoolPortalRole>([
  "chain_head",
  "principal",
  "teacher",
]);

export function readSchoolPortalRole(value: string | null): SchoolPortalRole {
  return value && SCHOOL_PORTAL_ROLES.has(value as SchoolPortalRole)
    ? (value as SchoolPortalRole)
    : "teacher";
}

export function canSchoolPortalRoleSignUp(role: SchoolPortalRole): boolean {
  return role === "teacher";
}

export function schoolAuthHref(
  role?: SchoolPortalRole,
  mode: "signin" | "signup" = "signin",
) {
  const params = new URLSearchParams({ portal: "schools" });
  if (role) params.set("role", role);
  if (role === "teacher" && mode === "signup") params.set("mode", "signup");
  return `/auth?${params.toString()}`;
}
