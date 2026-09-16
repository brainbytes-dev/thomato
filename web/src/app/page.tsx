import { Navigation } from "@/components/sections/Navigation";
import { Hero } from "@/components/sections/Hero";
import { Marquee } from "@/components/sections/Marquee";
import { TrustBar } from "@/components/sections/TrustBar";
import { Services } from "@/components/sections/Services";
import { Process } from "@/components/sections/Process";
import { Differentiators } from "@/components/sections/Differentiators";
import { Person } from "@/components/sections/Person";
import { FAQ } from "@/components/sections/FAQ";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/sections/Footer";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { brand } from "@/data/brand";

export default function Home() {
  return (
    <>
      <Navigation />

      {/* Fixed side label — editorial signature */}
      <div
        className="fixed left-3 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
        aria-hidden
      >
        <span
          className="eyebrow text-[0.55rem] text-muted-foreground/40"
          style={{ writingMode: "vertical-rl", letterSpacing: "0.22em" }}
        >
          {brand.name} · {brand.location}
        </span>
      </div>

      <main>
        <Hero />
        <Marquee />
        <TrustBar />
        <Services />
        <Process />
        <Differentiators />
        <Person />
        <Contact />
        <FAQ />
      </main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
