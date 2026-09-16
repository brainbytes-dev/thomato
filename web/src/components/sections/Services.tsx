import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "@/lib/motion";
import { brand, darfVorladen, type Offer, type Pillar } from "@/data/brand";

/**
 * Eine Leistungszeile als natives `details`. Der Inhalt steht damit im HTML,
 * für Suchmaschinen wie für Vorlesesoftware; vorher entstand er erst beim
 * Klick. Das Auf und Zu macht der Browser, ohne JavaScript und ohne Zustand.
 */
function ServiceRow({ offer }: { offer: Offer }) {
  return (
    <details className="group border-t border-border last:border-b">
      <summary className="w-full cursor-pointer list-none py-5 text-left transition-colors hover:bg-muted/20 sm:py-8 md:py-10 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3 px-4 sm:gap-6 sm:px-6 md:px-12 lg:px-24">
          <span
            aria-hidden
            className="w-12 shrink-0 text-right font-light tabular-nums text-muted-foreground/25 transition-colors group-hover:text-muted-foreground/40 sm:w-20"
            style={{ fontSize: "clamp(1.75rem, 4vw, 4rem)", lineHeight: 1 }}
          >
            {offer.id}
          </span>

          <div className="flex flex-1 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-4">
            <h4 className="text-xl font-light tracking-tight sm:text-2xl md:text-3xl">
              {offer.title}
            </h4>
            <span className="text-sm text-muted-foreground md:text-base">
              {offer.subtitle}
            </span>
          </div>

          <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition-all duration-300 group-hover:text-foreground group-open:rotate-45 group-open:text-brand" />
        </div>
      </summary>

      <div className="px-4 pb-6 sm:px-6 sm:pb-10 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 gap-6 border-t border-border pt-6 sm:gap-8 sm:pt-8 md:grid-cols-[1fr_1fr] md:gap-12">
          <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            {offer.description}
          </p>
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2">
              {offer.deliverables.map((item, j) => (
                <li key={j} className="flex items-start gap-3 text-sm">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-3">
              <Link
                href="#kontakt"
                className="eyebrow inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                Anfrage stellen
                <ArrowUpRight className="h-3 w-3" />
              </Link>
              {/* Nur einzelne Leistungen tragen ein eigenes Werkzeug. */}
              {"link" in offer && offer.link ? (
                <Link
                  href={offer.link.href}
                  prefetch={darfVorladen(offer.link.href)}
                  className="eyebrow inline-flex items-center gap-2 text-brand transition-colors hover:text-foreground"
                >
                  {offer.link.label}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}

/**
 * Pillar heading — the divider that tells the two halves of the business apart.
 * Heavier rule and far more space above than below, so it reads as a new chapter
 * rather than as another service row.
 */
function PillarHeading({ pillar, index }: { pillar: Pillar; index: number }) {
  return (
    <FadeIn
      id={pillar.id}
      className={`scroll-mt-20 border-t border-foreground/30 px-4 pb-6 sm:px-6 sm:pb-8 md:px-12 lg:px-24 ${
        index === 0 ? "pt-10 sm:pt-14" : "pt-20 sm:pt-32"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-16">
        <h3 className="text-3xl font-light tracking-tight sm:text-4xl md:text-5xl">
          {pillar.label}
        </h3>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-right">
          {pillar.description}
        </p>
      </div>
    </FadeIn>
  );
}

export function Services() {
  return (
    <section id="leistungen" className="py-14 sm:py-28">
      {/* Section header */}
      <FadeIn className="mb-10 flex items-end justify-between gap-4 px-4 sm:mb-16 sm:gap-8 sm:px-6 md:px-12 lg:px-24">
        <h2 className="display-lg max-w-lg">Was ich für Sie leiste.</h2>
        <p className="hidden max-w-xs text-right text-sm leading-relaxed text-muted-foreground md:block">
          Zwei Bereiche, ein Fundament – jahrelange Praxis im Schweizer
          Rettungsdienst.
        </p>
      </FadeIn>

      {/* Two pillars — full bleed rows, no container */}
      {brand.pillars.map((pillar, p) => (
        <div key={pillar.id}>
          <PillarHeading pillar={pillar} index={p} />
          {pillar.offers.map((offer) => (
            <ServiceRow key={`${pillar.id}-${offer.id}`} offer={offer} />
          ))}
          {/* Was wir nicht tun. Anfragen nach Postendienst kommen trotzdem,
              also lieber hier ehrlich beantwortet als im Gespräch ausweichen. */}
          {"note" in pillar && pillar.note ? (
            <FadeIn className="px-4 pt-8 sm:px-6 sm:pt-12 md:px-12 lg:px-24">
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {pillar.note}
              </p>
            </FadeIn>
          ) : null}
        </div>
      ))}
    </section>
  );
}
