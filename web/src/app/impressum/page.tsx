import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { brand } from "@/data/brand";

export const metadata: Metadata = {
  title: "Impressum",
  robots: { index: false, follow: false },
  alternates: { canonical: "/impressum" },
};

const sections = [
  {
    title: "Kontaktadresse",
    content: (
      <>
        <p className="text-muted-foreground">
          {brand.contact.owner}
          <br />
          {brand.contact.street}
          <br />
          {brand.contact.postalCode} {brand.contact.city}
          <br />
          {brand.contact.country}
        </p>
        <p className="text-muted-foreground">
          Telefon:{" "}
          <a
            href={`tel:${brand.contact.phone.replace(/\s/g, "")}`}
            className="text-foreground underline underline-offset-4 hover:text-brand transition-colors"
          >
            {brand.contact.phone}
          </a>
        </p>
        <p className="text-muted-foreground">
          E-Mail:{" "}
          <a
            href={`mailto:${brand.contact.email}`}
            className="text-foreground underline underline-offset-4 hover:text-brand transition-colors"
          >
            {brand.contact.email}
          </a>
        </p>
      </>
    ),
  },
  {
    title: "Haftungsausschluss",
    content: (
      <div className="flex flex-col gap-4 text-muted-foreground">
        <p>
          Thomato behält sich das Recht vor, keine Verantwortung für die Richtigkeit, Genauigkeit, Aktualität, Zuverlässigkeit und Vollständigkeit der Informationen zu übernehmen.
        </p>
        <p>
          Haftungsansprüche gegen den Autor wegen Schäden materieller oder immaterieller Art, welche aus dem Zugriff oder der Nutzung bzw. Nichtnutzung der veröffentlichten Informationen, durch Missbrauch der Verbindung oder durch technische Störungen entstanden sind, werden ausgeschlossen.
        </p>
        <p>
          Alle Angebote sind freibleibend und unverbindlich. Thomato behält es sich ausdrücklich vor, Teile der Seiten oder das gesamte Angebot ohne gesonderte Ankündigung zu verändern, zu ergänzen, zu löschen oder die Veröffentlichung zeitweise oder endgültig einzustellen.
        </p>
      </div>
    ),
  },
  {
    title: "Haftung für Links",
    content: (
      <p className="text-muted-foreground">
        Verweise und Links auf Webseiten Dritter liegen ausserhalb meines Verantwortungsbereiches. Jegliche Verantwortung für solche Websites wird abgelehnt. Der Zugang und die Benutzung solcher Websites erfolgt auf eigenes Risiko des Benutzers.
      </p>
    ),
  },
  {
    title: "Urheberrechte",
    content: (
      <p className="text-muted-foreground">
        Das Urheberrecht und alle anderen Rechte an Inhalten, Bildern, Fotos oder anderen Dateien auf der Website gehören ausschliesslich {brand.contact.owner} oder den speziell genannten Rechteinhabern. Für die Reproduktion jeglicher Elemente muss im Voraus die schriftliche Zustimmung der Urheberrechtsinhaber eingeholt werden.
      </p>
    ),
  },
  {
    title: "Datenschutz",
    content: (
      <div className="flex flex-col gap-4 text-muted-foreground">
        <p>
          Gestützt auf Artikel 13 der Schweizerischen Bundesverfassung und die Datenschutzbestimmungen des Bundes (Datenschutzgesetz, DSG) hat jede Person Anspruch auf den Schutz ihrer Privatsphäre und auf Schutz vor Missbrauch ihrer persönlichen Daten. Ich halte mich an diese Bestimmungen. Persönliche Daten werden streng vertraulich behandelt und nicht verkauft oder an Dritte weitergegeben.
        </p>
        <p>
          In enger Zusammenarbeit mit meinem Hosting-Provider bin ich bestrebt, die Datenbanken so weit wie möglich vor unberechtigtem Zugriff, Verlust, Missbrauch oder Fälschung zu schützen. Weitere Informationen zum Datenschutz entnehmen Sie bitte meiner Datenschutzerklärung.
        </p>
      </div>
    ),
  },
];

export default function ImpressumPage() {
  return (
    // systemzeiger holt den Mauszeiger zurück, den die Startseite global
    // ausblendet, weil sie ihn selbst zeichnet.
    <div className="systemzeiger min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-24 md:px-12">
        {/* Back link */}
        <Link
          href="/"
          className="mb-16 inline-flex items-center gap-2 eyebrow text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Zurück
        </Link>

        {/* Header */}
        <div className="mb-16 border-b border-border pb-10">
          <span className="eyebrow text-brand mb-3 block">{brand.name}</span>
          <h1 className="display-lg">Impressum</h1>
        </div>

        {/* Sections */}
        <div className="flex flex-col divide-y divide-border">
          {sections.map((section) => (
            <div key={section.title} className="grid grid-cols-1 gap-4 py-10 md:grid-cols-[200px_1fr] md:gap-12">
              <h2 className="text-sm font-medium">{section.title}</h2>
              <div className="text-sm leading-relaxed">{section.content}</div>
            </div>
          ))}

          {/* Stand */}
          <div className="grid grid-cols-1 gap-4 py-10 md:grid-cols-[200px_1fr] md:gap-12">
            <h2 className="text-sm font-medium">Stand</h2>
            <p className="text-sm text-muted-foreground">{brand.legalUpdated}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
