import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Rechner } from "@/components/rechner/rechner";
import {
  Abschluss,
  Erklaerung,
  HaeufigeFragen,
} from "@/components/rechner/inhalt";
import { ModeToggle } from "@/components/theme/theme-toggle";
import { LogoWordmark } from "@/components/ui/logo";
import { brand } from "@/data/brand";
import { rechner, rechnerUrl } from "@/data/rechner";

export const metadata: Metadata = {
  title: rechner.titel,
  description: rechner.beschreibung,
  alternates: { canonical: rechner.pfad },
  openGraph: {
    type: "website",
    locale: "de_CH",
    url: rechnerUrl,
    siteName: brand.name,
    title: rechner.titel,
    description: rechner.beschreibung,
  },
  // Sonst erbt X das Bild und die Beschreibung der Startseite.
  twitter: {
    card: "summary_large_image",
    title: rechner.titel,
    description: rechner.beschreibung,
  },
};

/**
 * Zwei Datensätze für die Suche: das Werkzeug selbst und die häufigen Fragen.
 * Letztere können als erweitertes Suchergebnis erscheinen, deshalb stehen die
 * Antworten hier wörtlich so wie auf der Seite.
 */
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: rechner.name,
    url: rechnerUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "de-CH",
    description: rechner.beschreibung,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "CHF" },
    publisher: {
      "@type": "Organization",
      name: brand.name,
      url: brand.meta.url,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: rechner.faq.map((f) => ({
      "@type": "Question",
      name: f.frage,
      acceptedAnswer: { "@type": "Answer", text: f.antwort },
    })),
  },
];

function Kopf() {
  return (
    <div className="space-y-5">
      <h1 className="display-lg max-w-[22ch] text-foreground">{rechner.h1}</h1>
      <div className="max-w-[65ch] space-y-4 text-base leading-relaxed text-muted-foreground">
        <p>{rechner.vorspann}</p>
        <p>{rechner.vorspannZwei}</p>
      </div>
    </div>
  );
}

export default function SanitaetsdienstRechnerSeite() {
  return (
    // rechner-seite begrenzt Bildlaufleiste und Zahlensatz auf diese Route.
    <div className="rechner-seite unterseite min-h-dvh">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Eigener schlanker Kopf statt der Hauptnavigation: deren Verweise
          zeigen auf Sprungmarken der Startseite, die es hier nicht gibt. */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
          <Link
            href="/"
            aria-label={`${brand.name}, zurück zur Startseite`}
            className="logo-link -my-1 inline-flex items-center gap-3 py-1.5 text-foreground"
          >
            <LogoWordmark className="h-5 w-auto" />
            <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
            <span className="hidden text-sm text-muted-foreground sm:block">
              {rechner.name}
            </span>
          </Link>
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Rechner kopf={<Kopf />} />

        <div className="mt-16 space-y-12 sm:mt-24 sm:space-y-16">
          <Erklaerung />
          <HaeufigeFragen />
          <Abschluss />
        </div>
      </main>

      <footer className="mt-16 border-t border-border">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Fragen zum Ergebnis?{" "}
            <a
              href={`mailto:${brand.contact.email}`}
              className="text-foreground underline decoration-border hover:decoration-brand"
            >
              {brand.contact.email}
            </a>
            .
          </p>
          <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            Grundlage sind die «{rechner.quelle.titel}», {rechner.quelle.ausgabe},
            herausgegeben vom{" "}
            <a
              href={rechner.quelle.url}
              className="text-foreground underline decoration-border hover:decoration-brand"
              rel="noopener noreferrer"
              target="_blank"
            >
              {rechner.quelle.herausgeber}
            </a>
            . Die Bemessung der Einsatzmittel ist an die Strukturen des
            schweizerischen Rettungswesens angepasst, wie es die Richtlinie in
            Ziff. 4.3 verlangt. Laienhelfer heissen hier Samariter, und der
            Krankentransportwagen KTW wird nicht ausgewiesen.
          </p>
          <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            Ihre Angaben bleiben in Ihrem Browser. Sie werden nicht gespeichert,
            nicht übertragen und nicht ausgewertet, solange Sie das Ergebnis
            nicht selbst per Mail anfordern.
          </p>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-foreground underline decoration-border hover:decoration-brand"
            >
              <ArrowLeft aria-hidden className="size-3.5" strokeWidth={1.75} />
              Zurück zu {brand.name}
            </Link>
            <Link
              href="/#sicherheit"
              className="text-muted-foreground underline decoration-border hover:text-foreground hover:decoration-brand"
            >
              Sanitäts- und Sicherheitskonzepte
            </Link>
            <Link
              href="/impressum"
              className="text-muted-foreground underline decoration-border hover:text-foreground hover:decoration-brand"
            >
              Impressum
            </Link>
            <Link
              href="/datenschutz"
              className="text-muted-foreground underline decoration-border hover:text-foreground hover:decoration-brand"
            >
              Datenschutz
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
