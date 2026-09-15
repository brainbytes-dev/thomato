import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { CookieBanner } from "@/components/consent/cookie-banner";
import { Analytics } from "@/components/consent/analytics";
import { brand } from "@/data/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: brand.meta.title,
    template: `%s | ${brand.name}`,
  },
  description: brand.meta.description,
  metadataBase: new URL(brand.meta.url),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_CH",
    url: brand.meta.url,
    siteName: brand.name,
    title: brand.meta.title,
    description: brand.meta.description,
  },
  twitter: {
    card: "summary_large_image",
    title: brand.meta.title,
    description: brand.meta.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/** Färbt die Adressleiste auf Android und im Vollbild passend zur Seite. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#020712" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: brand.name,
  description: brand.description,
  url: brand.meta.url,
  // Ohne Telefonnummer: sie steht nur im Impressum, und die
  // strukturierten Daten gehen an jede Suchmaschine.
  email: brand.contact.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: brand.contact.street,
    postalCode: brand.contact.postalCode,
    addressLocality: brand.contact.city,
    addressCountry: "CH",
  },
  image: `${brand.meta.url}/opengraph-image`,
  areaServed: brand.serviceArea.map((ort) => ({ "@type": "City", name: ort })),
  founder: {
    "@type": "Person",
    name: brand.person.name,
    jobTitle: "Rettungssanitäter",
  },
  foundingDate: brand.established.toString(),
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Leistungen",
    itemListElement: brand.offers.map((o) => ({
      "@type": "Offer",
      name: `${o.title} ${o.subtitle}`,
      description: o.description,
    })),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de-CH" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* First in the DOM so keyboard users reach the consent choice before
              the page content, while position:fixed keeps it visually at the bottom. */}
          <CookieBanner />
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
