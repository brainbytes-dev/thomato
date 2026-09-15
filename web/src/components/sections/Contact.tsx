"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { FadeIn } from "@/lib/motion";
import { brand } from "@/data/brand";

// ─── Schema ──────────────────────────────────────────────────────────
const contactSchema = z.object({
  name: z.string().min(2, "Bitte geben Sie Ihren Namen ein (min. 2 Zeichen)."),
  email: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
  phone: z.string().optional(),
  service: z.string().optional(),
  message: z.string().min(10, "Bitte beschreiben Sie Ihren Bedarf (min. 10 Zeichen)."),
});

type ContactFormValues = z.infer<typeof contactSchema>;

type FormState = "idle" | "loading" | "success" | "error";

// ─── Component ───────────────────────────────────────────────────────
export function Contact() {
  // react-hook-form ändert Werte an React vorbei und ist mit dem React
  // Compiler offiziell nicht getestet. Für dieses Formular bleibt die
  // Memoisierung deshalb aus.
  "use no memo";
  const [formState, setFormState] = useState<FormState>("idle");

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", service: "", message: "" },
  });

  // Kommt jemand vom Rechner, steht das Ergebnis schon im Formular. Gelesen
  // nach dem Laden aus der Adresse, damit die Seite statisch bleiben kann.
  //
  // Einen Tick verzögert: Im selben Durchgang wie das Einhängen registriert
  // das Auswahlfeld sich noch und überschreibt einen sofort gesetzten Wert
  // wieder mit leer. Der Textbereich hat eine echte DOM-Referenz und ist
  // davon nicht betroffen, das Auswahlfeld nicht.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const leistung = p.get("leistung");
    if (!leistung) return;
    const stufe = p.get("stufe");
    const titel = p.get("titel");
    const punkte = p.get("punkte");
    const ergebnis = stufe
      ? `Der Rechner ergibt Stufe ${stufe}${titel ? `, ${titel}` : ""}${punkte ? `, bei ${punkte} Risikopunkten` : ""}. Ich brauche dazu ein Sanitätskonzept für die Gemeinde.

Anlass, Datum und Ort: `
      : "";
    const t = window.setTimeout(() => {
      form.setValue("service", leistung, { shouldDirty: true });
      form.setValue("message", ergebnis, { shouldDirty: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [form]);

  async function onSubmit(values: ContactFormValues) {
    setFormState("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Server error");
      setFormState("success");
      form.reset();
    } catch {
      setFormState("error");
    }
  }

  return (
    <section id="kontakt" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-28 md:px-12 lg:px-24">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16 lg:gap-24">
        {/* Left – info */}
        <FadeIn className="flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <h2 className="display-lg">
              Jetzt unverbindlich anfragen.
            </h2>
          </div>

          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Schildern Sie mir Ihren Bedarf, ich melde mich in der Regel am selben Werktag mit einer persönlichen Einschätzung.
          </p>

          <Separator />

          <div className="flex flex-col gap-5">
            <a
              href={`mailto:${brand.contact.email}`}
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4 shrink-0 text-brand" />
              {brand.contact.email}
            </a>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-brand" />
              {brand.location}, {brand.region}
            </div>
          </div>
        </FadeIn>

        {/* Right – form */}
        <FadeIn delay={0.15} className="flex flex-col gap-6">
          {formState === "success" ? (
            <div className="flex flex-col items-center gap-4 rounded-sm border border-border bg-muted/30 p-8 text-center sm:p-12">
              <CheckCircle2 className="h-8 w-8 text-brand" />
              <div className="flex flex-col gap-1">
                <p className="font-medium">Vielen Dank für Ihre Anfrage.</p>
                <p className="text-sm text-muted-foreground">
                  Ich melde mich in Kürze persönlich bei Ihnen.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFormState("idle")}>
                Weitere Anfrage senden
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
                {/* Name & Email */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="eyebrow text-xs">Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Markus Weber" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="eyebrow text-xs">E-Mail *</FormLabel>
                        <FormControl>
                          <Input placeholder="m.weber@gemeinde.ch" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Phone & Service */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="eyebrow text-xs">Telefon (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+41 xx xxx xx xx" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="service"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="eyebrow text-xs">Leistung (optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              {/* Der Text steht ausdrücklich drin: Radix zeigt einen gesetzten
                                  Wert sonst erst, wenn die Liste einmal offen war, und die
                                  Vorbelegung vom Rechner käme leer an. */}
                              <SelectValue placeholder="Wählen Sie eine Leistung">
                                {field.value || undefined}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {brand.serviceGroups.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel className="eyebrow text-brand">
                                  {group.label}
                                </SelectLabel>
                                {group.options.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Message */}
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="eyebrow text-xs">Nachricht *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Beschreiben Sie kurz Ihren Bedarf: bei Veranstaltungen Art, Datum und erwartete Besucherzahl, bei Software den Ablauf, der Ihnen heute Mühe macht."
                          className="min-h-32 resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Error state */}
                {formState === "error" && (
                  <div className="flex items-center gap-2 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut oder schreiben Sie mir direkt per E-Mail.
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={formState === "loading"}
                  className="w-full sm:w-auto"
                >
                  {formState === "loading" ? "Wird gesendet…" : "Anfrage senden"}
                </Button>

                <p className="text-xs text-muted-foreground">
                  * Pflichtfelder. Ihre Daten werden ausschliesslich zur Bearbeitung Ihrer Anfrage verwendet.
                </p>
              </form>
            </Form>
          )}
        </FadeIn>
      </div>
    </section>
  );
}
