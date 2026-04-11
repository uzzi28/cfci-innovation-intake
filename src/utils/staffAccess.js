/**
 * Controls visibility of the staff Submissions nav link.
 * Backend currently allows any authenticated JWT for /api/admin/*; this only gates the UI.
 * - Unset VITE_STAFF_EMAILS: show link for all signed-in users (prototype default).
 * - Set to comma-separated emails: only those users see the link.
 * - Set to "*" to explicitly allow all signed-in users.
 */
export function canSeeStaffNav(email) {
  const raw = import.meta.env.VITE_STAFF_EMAILS;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return true;
  }
  const normalized = String(raw).trim();
  if (normalized === '*') return true;
  const allowed = normalized
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes((email || '').toLowerCase());
}
