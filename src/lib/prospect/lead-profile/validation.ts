import { z } from "zod";

/** Champs obligatoires — entrée conversationnelle (pas qualification CRM). */
export const PreChatRequiredSchema = z.object({
  name: z.string().trim().min(2).max(60),
  contact: z.string().trim().min(6).max(120),
});

/** Message optionnel avant le chat — léger, non commercial. */
export const PreChatOptionalMessageSchema = z
  .string()
  .trim()
  .max(280)
  .optional()
  .transform((v) => (v && v.length >= 1 ? v : undefined));

export const PreChatFormSchema = PreChatRequiredSchema.extend({
  primaryNeed: PreChatOptionalMessageSchema,
  city: z.string().trim().max(80).optional(),
  businessName: z.string().trim().max(120).optional(),
  budget: z.string().trim().max(60).optional(),
});

export type PreChatFormInput = z.infer<typeof PreChatFormSchema>;

export function parsePreChatForm(data: {
  name: string;
  contact: string;
  primaryNeed?: string;
  city?: string;
  businessName?: string;
  budget?: string;
}) {
  return PreChatFormSchema.safeParse(data);
}
