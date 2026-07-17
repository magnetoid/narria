/** Identity of a demo workspace. Minted by the proxy so each visitor gets their
 *  own books with zero setup; holds no credential, only a random workspace id. */
export const DEMO_UID_COOKIE = "narria_demo_uid";

/** True when real Supabase Auth can run: auth needs the browser-usable pair, so
 *  this is stricter than isDbConfigured(), which also accepts URL + service-role.
 *  A deployment that satisfies only the latter is a misconfiguration, not demo
 *  mode — getSessionUser() refuses it, since demo identity is only safe with the
 *  memory store behind it.
 *
 *  Read by the proxy, the login UI/actions and the auth routes. Everywhere else
 *  goes through getSessionUser(), which is the only reader of the auth mode. */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
