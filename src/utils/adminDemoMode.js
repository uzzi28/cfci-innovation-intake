/**
 * Admin preview without JWT or API: mock submissions + local template editor.
 * Enable with ?demo=1 on /admin or VITE_ADMIN_DEMO_MODE=true (works in production builds too).
 */
export function computeAdminDemoMode(searchParams) {
  const env = import.meta.env.VITE_ADMIN_DEMO_MODE;
  if (env === 'true' || env === '1') return true;
  return searchParams.get('demo') === '1';
}
