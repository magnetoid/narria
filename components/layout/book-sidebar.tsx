"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "./logo";
import { Icon } from "@/components/icon";
import { BOOK_NAV, getBookType } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Book } from "@/lib/db/types";

export function BookSidebar({ book }: { book: Book }) {
  const pathname = usePathname();
  const type = getBookType(book.book_type);

  const navLinks = BOOK_NAV.map((item) => {
    const href = `/books/${book.id}/${item.segment}`;
    const active = pathname.startsWith(href);
    return { ...item, href, active };
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/40 md:flex">
        <div className="flex h-16 items-center border-b border-line/70 px-4">
          <Logo />
        </div>
        <div className="border-b border-line/70 p-4">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            Library
          </Link>
          <div className="flex items-start gap-2.5">
            <span className="text-2xl leading-none">{book.cover_emoji}</span>
            <div className="min-w-0">
              <div className="truncate font-serif text-base font-semibold text-ink">
                {book.title}
              </div>
              <div className="text-xs text-muted">{type.label}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navLinks.map((item) => (
            <Link
              key={item.segment}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                item.active
                  ? "bg-accent-soft text-accent"
                  : "text-ink-soft hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon name={item.icon} className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile top nav */}
      <header className="sticky top-0 z-30 flex flex-col border-b border-line bg-paper/90 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />
          <Link href="/" className="text-xs text-muted">
            Library
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {navLinks.map((item) => (
            <Link
              key={item.segment}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
                item.active ? "bg-accent-soft text-accent" : "text-ink-soft",
              )}
            >
              <Icon name={item.icon} className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
