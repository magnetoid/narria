import Link from "next/link";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";

export function Logo({
  href = "/",
  showWordmark = true,
  className,
}: {
  href?: string | null;
  showWordmark?: boolean;
  className?: string;
}) {
  const mark = (
    <span className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-[0.55rem] bg-accent font-serif text-lg font-semibold leading-none text-white shadow-sm">
        N
      </span>
      {showWordmark ? (
        <span className="font-serif text-xl font-semibold tracking-tight text-ink">
          {SITE.name}
        </span>
      ) : null}
    </span>
  );

  if (!href) return <span className={className}>{mark}</span>;

  return (
    <Link href={href} className={cn("inline-flex items-center", className)}>
      {mark}
    </Link>
  );
}
