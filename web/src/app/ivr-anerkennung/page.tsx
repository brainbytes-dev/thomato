import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ModeToggle } from "@/components/theme/theme-toggle";
import { LogoWordmark } from "@/components/ui/logo";
import { brand } from "@/data/brand";
import { ivr, ivrUrl } from "@/data/ivr-anerkennung";

export const metadata: Metadata = {
  title: ivr.titel,
  description: ivr.beschreibung,
  alternates: { canonical: ivr.pfad },
  openGraph: {
    type: "website",
    locale: "de_CH",
    url: ivrUrl,
    siteName: brand.name,
    title: ivr.titel,
    description: ivr.beschreibung,
  },
  // Sonst erbt X das Bild und die Beschreibung der Startseite.
  twitter: {
    card: "summary_large_image",
    title: ivr.titel,
    description: ivr.beschreibung,
  },
};

/**
 * Zwei Datensätze für die Suche: die Anwendung selbst und die häufigen
 * Fragen. Letztere können als erweitertes Suchergebnis erscheinen, deshalb
 * stehen die Antworten hier wörtlich so wie auf der Seite.
 */
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: ivr.name,
    url: ivrUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "de-CH",
    description: ivr.beschreibung,
    author: { "@type": "Organization", name: brand.name, url: brand.meta.url },
    publisher: {
      "@type": "Organization",
      name: brand.name,
      url: brand.meta.url,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ivr.faq.map((f) => ({
      "@type": "Question",
      name: f.frage,
      acceptedAnswer: { "@type": "Answer", text: f.antwort },
    })),
  },
];

/** Der Knopf zur Demo, oder der ehrliche Hinweis, wenn keine läuft.
    Mit `knapp` steht er ein zweites Mal am Ende der Seite, kürzer
    beschriftet und ohne die Erklärung, die oben schon stand. */
function DemoZugang({ knapp = false }: { knapp?: boolean }) {
  if (!ivr.demo.url) {
    return (
      <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
        Eine Demo mit erfundenen Daten führe ich auf Anfrage vor.{" "}
        <Link
          href="/#kontakt"
          className="text-foreground underline decoration-border hover:decoration-brand"
        >
          Termin vereinbaren
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {/* Die Demo läuft unter demselben Namen, /ivr-anerkennung/demo.
          Deshalb kein neues Fenster und kein rel für Fremde. */}
      <a
        href={ivr.demo.url}
        className="inline-flex items-center gap-2 rounded-sm bg-brand-solid px-5 py-3 text-sm font-medium text-brand-solid-foreground transition-opacity hover:opacity-90"
      >
        {knapp ? ivr.demo.labelKurz : ivr.demo.label}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </a>
      {!knapp && (
        <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {ivr.demo.zugang} {ivr.demo.hinweis}
        </p>
      )}
    </div>
  );
}

/** Ein Abschnitt mit Bild. Die Bilder wechseln die Seite, damit das Auge
    beim Scrollen einen Rhythmus bekommt. */
function Bereich({
  eintrag,
  gespiegelt,
}: {
  eintrag: (typeof ivr.bereiche)[number];
  gespiegelt: boolean;
}) {
  return (
    <section
      id={eintrag.id}
      className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
    >
      <div className={gespiegelt ? "lg:order-2" : undefined}>
        <h3 className="text-xl font-medium text-foreground sm:text-2xl">
          {eintrag.titel}
        </h3>
        <p className="mt-3 max-w-[58ch] text-base leading-relaxed text-muted-foreground">
          {eintrag.text}
        </p>
      </div>
      <figure
        className={`overflow-hidden rounded-sm border border-border bg-muted ${
          gespiegelt ? "lg:order-1" : ""
        }`}
      >
        <Image
          src={eintrag.bild}
          alt={eintrag.alt}
          width={1518}
          height={784}
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="h-auto w-full"
        />
      </figure>
    </section>
  );
}

export default function IvrAnerkennungSeite() {
  return (
    <div className="min-h-dvh">
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
              {ivr.name}
            </span>
          </Link>
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="space-y-5">
          <p className="eyebrow">Fachanwendung</p>
          <h1 className="display-lg max-w-[24ch] text-foreground">{ivr.h1}</h1>
          <div className="max-w-[65ch] space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>{ivr.vorspann}</p>
            <p>{ivr.vorspannZwei}</p>
          </div>
          <DemoZugang />
        </div>

        <div className="mt-16 space-y-16 sm:mt-24 sm:space-y-24">
          <section className="max-w-[65ch] space-y-4">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              {ivr.problem.titel}
            </h2>
            {ivr.problem.absaetze.map((absatz) => (
              <p
                key={absatz.slice(0, 24)}
                className="text-base leading-relaxed text-muted-foreground"
              >
                {absatz}
              </p>
            ))}
          </section>

          <div className="space-y-16 sm:space-y-24">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              Was die Anwendung zeigt
            </h2>
            {ivr.bereiche.map((eintrag, i) => (
              <Bereich
                key={eintrag.id}
                eintrag={eintrag}
                gespiegelt={i % 2 === 1}
              />
            ))}
          </div>

          <section className="space-y-6">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              Und ausserdem
            </h2>
            <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {ivr.weiteres.map((eintrag) => (
                <div key={eintrag.titel} className="space-y-2">
                  <dt className="font-medium text-foreground">
                    {eintrag.titel}
                  </dt>
                  <dd className="max-w-[54ch] text-base leading-relaxed text-muted-foreground">
                    {eintrag.text}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="max-w-[65ch] space-y-4">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              {ivr.zielgruppen.titel}
            </h2>
            {ivr.zielgruppen.absaetze.map((absatz) => (
              <p
                key={absatz.slice(0, 24)}
                className="text-base leading-relaxed text-muted-foreground"
              >
                {absatz}
              </p>
            ))}
            <ul className="space-y-2 text-base leading-relaxed text-muted-foreground">
              {ivr.zielgruppen.punkte.map((punkt) => (
                <li key={punkt} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2.5 h-px w-4 shrink-0 bg-border"
                  />
                  <span>{punkt}</span>
                </li>
              ))}
            </ul>
            <p className="text-base leading-relaxed text-muted-foreground">
              {ivr.zielgruppen.schluss}
            </p>
          </section>

          <section className="max-w-[65ch] space-y-4">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              {ivr.technik.titel}
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              {ivr.technik.text}
            </p>
            <ul className="space-y-2 text-base leading-relaxed text-muted-foreground">
              {ivr.technik.punkte.map((punkt) => (
                <li key={punkt} className="flex gap-3">
                  <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-border" />
                  <span>{punkt}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="max-w-[65ch] space-y-8">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              Häufige Fragen
            </h2>
            <dl className="space-y-8">
              {ivr.faq.map((f) => (
                <div key={f.frage} className="space-y-2">
                  <dt className="font-medium text-foreground">{f.frage}</dt>
                  <dd className="text-base leading-relaxed text-muted-foreground">
                    {f.antwort}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="max-w-[65ch] space-y-4">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              {ivr.abschluss.titel}
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              {ivr.abschluss.text}
            </p>
            {/* Wer bis hierher gelesen hat, soll nicht nach oben scrollen
                müssen, um die Demo zu finden. */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/#kontakt"
                className="inline-flex items-center gap-2 rounded-sm bg-brand-solid px-5 py-3 text-sm font-medium text-brand-solid-foreground transition-opacity hover:opacity-90"
              >
                Anfrage schreiben
              </Link>
              {ivr.demo.url ? (
                <a
                  href={ivr.demo.url}
                  className="inline-flex items-center gap-2 rounded-sm border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-brand"
                >
                  {ivr.demo.labelKurz}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-16 border-t border-border">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Fragen zur Anwendung?{" "}
            <a
              href={`mailto:${brand.contact.email}`}
              className="text-foreground underline decoration-border hover:decoration-brand"
            >
              {brand.contact.email}
            </a>
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Die Bilder stammen aus der Demo. Alle darin gezeigten Betriebe,
            Fälle und Messwerte sind erfunden.
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Startseite
            </Link>
            <Link href="/#software" className="hover:text-foreground">
              Digitale Lösungen
            </Link>
            <Link href="/impressum" className="hover:text-foreground">
              Impressum
            </Link>
            <Link href="/datenschutz" className="hover:text-foreground">
              Datenschutz
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
