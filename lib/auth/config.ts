/** Identity of a demo workspace. Minted by the proxy so each visitor gets their
 *  own books with zero setup; holds no credential, only a random workspace id. */
export const DEMO_UID_COOKIE = "narria_demo_uid";

/** True when real Supabase Auth can run. Deliberately stricter than
 *  isDbConfigured(): auth needs the browser-usable pair, so a service-role-only
 *  deployment stays in demo mode rather than half-enabling sign-in.
 *
 *  Read by the proxy, the login UI/actions and the auth routes. Everywhere else
 *  goes through getSessionUser(), which is the only reader of the auth mode. */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
