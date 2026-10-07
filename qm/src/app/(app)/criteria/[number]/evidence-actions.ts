"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { addDocumentVersion, createDocument, linkEvidence, unlinkEvidence } from "@/domain/documents";
import { ForbiddenError, ValidationError, type OrgContext } from "@/domain/org-context";
import { requireOrgContextOrRedirect } from "@/domain/request-context";
import { can } from "@/domain/rights";
import { linkInput, readFile, unlinkInput, uploadInput, versionInput } from "./evidence-input";

export type EvidenceFormState = { ok: boolean; message: string } | null;

const INVALID = "Eingabe unvollständig oder ungültig.";
const FORBIDDEN = "Keine Berechtigung für diese Änderung.";
const NO_FILE = "Bitte eine nicht leere Datei bis 4 MiB auswählen.";

function revalidateEvidence(number: string) {
  revalidatePath("/");
  revalidatePath("/criteria");
  revalidatePath(`/criteria/${encodeURIComponent(number)}`);
  revalidatePath("/documents");
}

/** Gemeinsamer Ablauf: Eingabe prüfen, Kontext, Recht, dann die eigentliche Änderung. Ändert nie criterion_assessment. */
async function run<S extends z.ZodType<{ number: string }>>(
  schema: S,
  formData: FormData,
  success: string,
  work: (ctx: OrgContext, data: z.output<S>, now: Date) => Promise<{ criterionNumber: string } | void>,
): Promise<EvidenceFormState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: INVALID };
  const ctx = await requireOrgContextOrRedirect();
  if (!can(ctx.role, "document", "write")) return { ok: false, message: FORBIDDEN };
  let revalidated = parsed.data.number;
  try {
    const done = await work(ctx, parsed.data, new Date());
    if (done) revalidated = done.criterionNumber;
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    if (e instanceof ForbiddenError) return { ok: false, message: FORBIDDEN };
    throw e;
  }
  revalidateEvidence(revalidated);
  return { ok: true, message: success };
}

export async function uploadDocumentAction(_prev: EvidenceFormState, formData: FormData): Promise<EvidenceFormState> {
  const entry = formData.get("file");
  return run(uploadInput, formData, "Dokument hochgeladen.", async (ctx, data) => {
    const file = await readFile(entry);
    if (!file) throw new ValidationError(NO_FILE);
    await createDocument(ctx, {
      title: data.title,
      file,
      validUntil: data.validUntil ? data.validUntil : null,
      criterionNumbers: [data.number],
    });
  });
}

export async function addVersionAction(_prev: EvidenceFormState, formData: FormData): Promise<EvidenceFormState> {
  const entry = formData.get("file");
  return run(versionInput, formData, "Neue Version gespeichert.", async (ctx, data) => {
    const file = await readFile(entry);
    if (!file) throw new ValidationError(NO_FILE);
    await addDocumentVersion(ctx, data.documentId, { file, validUntil: data.validUntil ? data.validUntil : null });
  });
}

export async function linkEvidenceAction(_prev: EvidenceFormState, formData: FormData): Promise<EvidenceFormState> {
  return run(linkInput, formData, "Nachweis verknüpft.", async (ctx, data) => {
    await linkEvidence(ctx, data.documentId, data.number);
  });
}

export async function unlinkEvidenceAction(_prev: EvidenceFormState, formData: FormData): Promise<EvidenceFormState> {
  return run(unlinkInput, formData, "Verknüpfung gelöst.", async (ctx, data) => {
    return unlinkEvidence(ctx, data.linkId);
  });
}
