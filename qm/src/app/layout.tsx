import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/brand";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { FONT_CLASSES } from "./fonts";

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: das Inline-Skript setzt data-theme vor der Hydration.
    <html lang="de" className={`${FONT_CLASSES} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
