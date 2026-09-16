"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/theme/theme-toggle";
import { LogoWordmark } from "@/components/ui/logo";
import { brand, darfVorladen } from "@/data/brand";

type NavEintrag = (typeof brand.nav)[number];

/** Die Unterpunkte eines Hauptpunkts, oder nichts. Nur die Säulen tragen welche. */
function unterpunkte(item: NavEintrag) {
  return "children" in item ? item.children : [];
}

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border"
          : "bg-transparent"
      }`}
    >
      <nav className="flex items-center justify-between px-6 py-5 md:px-12 lg:px-24">
        {/* Logo */}
        <Link
          href="/"
          aria-label={`${brand.name} – Startseite`}
          className="logo-link text-foreground"
        >
          <LogoWordmark className="h-[26px] w-auto" />
        </Link>

        {/* Desktop nav. Ein Hauptpunkt bleibt ein Verweis auf seinen
            Abschnitt; die Unterpunkte klappen beim Überfahren oder per
            Tastatur darunter auf. Der Aufklappbereich beginnt ohne Lücke am
            Hauptpunkt, sonst schliesst er sich auf dem Weg dorthin. */}
        <ul className="hidden items-center gap-8 lg:flex xl:gap-10">
          {brand.nav.map((item) => {
            const kinder = unterpunkte(item);
            return (
              <li key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className="eyebrow inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                  {kinder.length > 0 && (
                    <ChevronDown
                      aria-hidden
                      className="h-3 w-3 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
                    />
                  )}
                </Link>
                {kinder.length > 0 && (
                  <div className="invisible absolute left-0 top-full pt-3 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <ul className="min-w-56 rounded-sm border border-border bg-background/95 py-2 shadow-lg backdrop-blur-md">
                      {kinder.map((kind) => (
                        <li key={kind.href}>
                          <Link
                            href={kind.href}
                            prefetch={darfVorladen(kind.href)}
                            className="block px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
                          >
                            {kind.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Desktop right: theme toggle + CTA */}
        <div className="hidden items-center gap-3 lg:flex">
          <ModeToggle />
          <Button asChild size="sm">
            <Link href="#kontakt">{brand.hero.cta.primary}</Link>
          </Button>
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <ModeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menü öffnen">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 px-6 pt-16">
              <nav className="flex flex-col gap-2">
                {brand.nav.map((item) => (
                  <div key={item.href} className="flex flex-col">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="py-3 text-base text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                    {/* Unterpunkte eingerückt direkt darunter, wie in einer
                        Gliederung; ein Aufklappen lohnt sich bei einem
                        Eintrag je Säule nicht. */}
                    {unterpunkte(item).map((kind) => (
                      <Link
                        key={kind.href}
                        href={kind.href}
                        prefetch={darfVorladen(kind.href)}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 py-2 pl-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span aria-hidden className="h-px w-3 shrink-0 bg-border" />
                        {kind.label}
                      </Link>
                    ))}
                  </div>
                ))}
                <Separator className="my-4" />
                <Button asChild>
                  <Link href="#kontakt" onClick={() => setOpen(false)}>
                    {brand.hero.cta.primary}
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
