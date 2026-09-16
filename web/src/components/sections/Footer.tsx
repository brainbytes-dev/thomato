"use client";
import Link from "next/link";
import { brand } from "@/data/brand";
import { ArrowRight, Mail, MapPin } from "lucide-react";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LogoWordmark } from "@/components/ui/logo";
import { ContoursCanvas } from "@/components/ui/contours-canvas";
import { openConsentSettings } from "@/lib/consent";

export function Footer() {
  const year = new Date().getFullYear();
  const lockupRef = useRef<HTMLDivElement>(null);
  const lockupInView = useInView(lockupRef, { once: true, margin: "-80px" });

  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-background via-background to-background/95">
      {/* Dieselben Höhenlinien wie im Hero, aus derselben Datei. Sie rechnen
          nur, während der Fuss im Bild ist. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <ContoursCanvas
          farben={{
            dunkel: { major: "rgba(100,150,220,.5)", minor: "rgba(100,150,220,.25)" },
            hell: { major: "rgba(0,0,0,.18)", minor: "rgba(0,0,0,.09)" },
          }}
          staerke={{ major: 2.2, minor: 1.4 }}
          className="mix-blend-multiply dark:mix-blend-lighten"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 md:px-12 lg:px-24">
        <div className="mb-20 grid grid-cols-1 gap-16 md:grid-cols-4">
          {/* Marke */}
          <div className="md:col-span-1">
            <div className="flex flex-col gap-4">
              {/* Wie in der Navigation: logo-link lässt die Blätter beim
                  Überfahren aufgehen. Der Ring zeichnet sich beim Hereinscrollen,
                  dafür bleibt der ref auf dem Wrapper. */}
              <div ref={lockupRef} className="w-fit text-foreground">
                <Link
                  href="/"
                  aria-label={`${brand.name} – Startseite`}
                  className="logo-link block"
                >
                  <LogoWordmark className="h-9 w-auto" animate={lockupInView} />
                </Link>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-foreground/70">
                {brand.tagline}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h2 className="eyebrow mb-6 text-xs text-foreground">Navigation</h2>
            <nav className="flex flex-col gap-4">
              {brand.nav.map((item) => (
                <div key={item.href} className="flex flex-col gap-3">
                  <Link
                    href={item.href}
                    className="group flex items-center gap-2 text-sm text-foreground/65 transition-all duration-300 hover:text-foreground"
                  >
                    <span className="opacity-0 transition-opacity group-hover:opacity-100">
                      <ArrowRight className="h-3 w-3" />
                    </span>
                    {item.label}
                  </Link>
                  {/* Die Werkzeuge eingerückt unter ihrer Säule, wie in der
                      Hauptnavigation. */}
                  {"children" in item &&
                    item.children.map((kind) => (
                      <Link
                        key={kind.href}
                        href={kind.href}
                        className="group flex items-center gap-2 pl-5 text-sm text-foreground/65 transition-all duration-300 hover:text-foreground"
                      >
                        <span className="opacity-0 transition-opacity group-hover:opacity-100">
                          <ArrowRight className="h-3 w-3" />
                        </span>
                        {kind.label}
                      </Link>
                    ))}
                </div>
              ))}
            </nav>
          </div>

          {/* Kontakt */}
          <div>
            <h2 className="eyebrow mb-6 text-xs text-foreground">Kontakt</h2>
            <div className="flex flex-col gap-4">
              <a
                href={`mailto:${brand.contact.email}`}
                className="group flex items-center gap-3 text-sm text-foreground/65 transition-all duration-300 hover:text-foreground"
              >
                <Mail className="h-4 w-4 flex-shrink-0 transition-colors group-hover:text-brand" />
                <span className="truncate">{brand.contact.email}</span>
              </a>
              <div className="flex items-start gap-3 text-sm text-foreground/65">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand/60" />
                <span>
                  {brand.location}
                  <br />
                  {brand.region}
                </span>
              </div>
            </div>
          </div>

          {/* Nächster Schritt */}
          <div className="flex flex-col justify-between gap-4">
            <div>
              <h2 className="eyebrow mb-4 text-xs text-foreground">Nächster Schritt</h2>
              <p className="text-xs leading-relaxed text-foreground/65">
                Schildern Sie mir Ihr Anliegen. Ich melde mich in der Regel am
                selben Werktag.
              </p>
            </div>
            <Button asChild size="lg" className="group w-full sm:w-auto">
              <Link href="#kontakt">
                Anfrage stellen
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mb-12 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />

        <div className="flex flex-col gap-3 text-xs text-foreground/65 sm:flex-row sm:items-center sm:gap-6">
          <span>
            © {year} {brand.name}. Alle Rechte vorbehalten.
          </span>
          <div className="flex gap-6">
            <Link
              href="/impressum"
              className="transition-colors duration-300 hover:text-foreground"
            >
              Impressum
            </Link>
            <Link
              href="/datenschutz"
              className="transition-colors duration-300 hover:text-foreground"
            >
              Datenschutz
            </Link>
            <button
              type="button"
              onClick={openConsentSettings}
              className="text-left transition-colors duration-300 hover:text-foreground"
            >
              Cookie-Einstellungen
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
