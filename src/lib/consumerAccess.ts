/**
 * Curve is B2C: the only account type that can sign in is a student.
 *
 * Roles come from several places (school membership, user_profiles.role,
 * account_type, auth metadata) and legacy consumer accounts often have none at
 * all — those are students, so a missing role passes. Everything staff-shaped
 * is blocked.
 */
export const STAFF_ROLES = [
  'teacher',
  'principal',
  'org_admin',
  'chain_admin',
  'chain_head',
  'school_admin',
  'admin',
  'parent',
] as const;

export function isStudentRole(role: unknown): boolean {
  if (typeof role !== 'string') return true; // no role recorded = consumer student
  const normalized = role.trim().toLowerCase();
  if (!normalized) return true;
  return !STAFF_ROLES.includes(normalized as (typeof STAFF_ROLES)[number]);
}

export const STAFF_SIGN_IN_MESSAGE =
  'This is a student account area. School and staff accounts can no longer sign in here.';
