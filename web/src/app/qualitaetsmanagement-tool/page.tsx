import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { ModeToggle } from "@/components/theme/theme-toggle";
import { LogoWordmark } from "@/components/ui/logo";
import { brand } from "@/data/brand";
import { qmTool, qmToolUrl } from "@/data/qualitaetsmanagement-tool";

export const metadata: Metadata = {
  title: qmTool.titel,
  description: qmTool.beschreibung,
  alternates: { canonical: qmTool.pfad },
  openGraph: {
    type: "website",
    locale: "de_CH",
    url: qmToolUrl,
    siteName: brand.name,
    title: qmTool.titel,
    description: qmTool.beschreibung,
  },
  // Sonst erbt X das Bild und die Beschreibung der Startseite.
  twitter: {
    card: "summary_large_image",
    title: qmTool.titel,
    description: qmTool.beschreibung,
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
    name: qmTool.name,
    url: qmToolUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "de-CH",
    description: qmTool.beschreibung,
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
    mainEntity: qmTool.faq.map((f) => ({
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
  if (!qmTool.demo.url) {
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
      {/* Die Demo läuft unter demselben Namen, /qualitaetsmanagement-tool/demo.
          Deshalb kein neues Fenster und kein rel für Fremde. */}
      <a
        href={qmTool.demo.url}
        className="inline-flex items-center gap-2 rounded-sm bg-brand-solid px-5 py-3 text-sm font-medium text-brand-solid-foreground transition-opacity hover:opacity-90"
      >
        {knapp ? qmTool.demo.labelKurz : qmTool.demo.label}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </a>
      {!knapp && (
        <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {qmTool.demo.zugang} {qmTool.demo.hinweis}
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
  eintrag: (typeof qmTool.bereiche)[number];
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

/** Eine Preisstufe. Die erste ist hervorgehoben, weil sie die Antwort für
    die meisten ist; die zweite steht gleichberechtigt daneben und nicht
    kleiner. */
function Stufe({ stufe }: { stufe: (typeof qmTool.preise.stufen)[number] }) {
  return (
    <div
      className={`flex flex-col rounded-sm border p-6 sm:p-8 ${
        stufe.hervor
          ? "border-brand bg-brand/[0.04]"
          : "border-border bg-transparent"
      }`}
    >
      <h3 className="text-lg font-medium text-foreground">{stufe.name}</h3>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
          {stufe.preis}
        </span>
        {stufe.takt ? (
          <span className="text-sm text-muted-foreground">{stufe.takt}</span>
        ) : null}
      </p>
      <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-muted-foreground">
        {stufe.text}
      </p>
      <ul className="mt-6 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {stufe.punkte.map((punkt) => (
          <li key={punkt} className="flex gap-3">
            <Check aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />
            <span>{punkt}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function QualitaetsmanagementToolSeite() {
  return (
    <div className="unterseite min-h-dvh">
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
              {qmTool.name}
            </span>
          </Link>
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="space-y-5">
          <p className="eyebrow">Fachanwendung</p>
          <h1 className="display-lg max-w-[24ch] text-foreground">{qmTool.h1}</h1>
          <div className="max-w-[65ch] space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>{qmTool.vorspann}</p>
            <p>{qmTool.vorspannZwei}</p>
          </div>
          <DemoZugang />
        </div>

        <div className="mt-16 space-y-16 sm:mt-24 sm:space-y-24">
          <section className="max-w-[65ch] space-y-4">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              {qmTool.problem.titel}
            </h2>
            {qmTool.problem.absaetze.map((absatz) => (
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
            {qmTool.bereiche.map((eintrag, i) => (
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
              {qmTool.weiteres.map((eintrag) => (
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
              {qmTool.zielgruppen.titel}
            </h2>
            {qmTool.zielgruppen.absaetze.map((absatz) => (
              <p
                key={absatz.slice(0, 24)}
                className="text-base leading-relaxed text-muted-foreground"
              >
                {absatz}
              </p>
            ))}
            <ul className="space-y-2 text-base leading-relaxed text-muted-foreground">
              {qmTool.zielgruppen.punkte.map((punkt) => (
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
              {qmTool.zielgruppen.schluss}
            </p>
          </section>

          <section className="max-w-[65ch] space-y-4">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              {qmTool.technik.titel}
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              {qmTool.technik.text}
            </p>
            <ul className="space-y-2 text-base leading-relaxed text-muted-foreground">
              {qmTool.technik.punkte.map((punkt) => (
                <li key={punkt} className="flex gap-3">
                  <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-border" />
                  <span>{punkt}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-6">
            <div className="max-w-[65ch] space-y-4">
              <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
                {qmTool.preise.titel}
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                {qmTool.preise.vorspann}
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {qmTool.preise.stufen.map((stufe) => (
                <Stufe key={stufe.name} stufe={stufe} />
              ))}
            </div>
            <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
              {qmTool.preise.fussnote}
            </p>
          </section>

          <section className="max-w-[65ch] space-y-8">
            <h2 className="text-2xl font-medium text-foreground sm:text-3xl">
              Häufige Fragen
            </h2>
            <dl className="space-y-8">
              {qmTool.faq.map((f) => (
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
              {qmTool.abschluss.titel}
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              {qmTool.abschluss.text}
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
              {qmTool.demo.url ? (
                <a
                  href={qmTool.demo.url}
                  className="inline-flex items-center gap-2 rounded-sm border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-brand"
                >
                  {qmTool.demo.labelKurz}
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
