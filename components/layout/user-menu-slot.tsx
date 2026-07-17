import { getSessionUser } from "@/lib/auth/session";
import { UserMenu } from "./user-menu";

/** Server wrapper: resolves the session once and hands the client plain props.
 *  Rendered as a prop/child so client shells can host it without going async. */
export async function UserMenuSlot({ className }: { className?: string }) {
  const user = await getSessionUser();
  // Signed out in real mode — the proxy already redirects, so render nothing.
  if (!user) return null;

  return <UserMenu email={user.email} isDemo={user.isDemo} className={className} />;
}
