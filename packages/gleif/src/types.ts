import { z } from "zod"

// ---- Raw GLEIF JSON:API schemas (lenient: GLEIF nulls/omits freely) ----

const addressSchema = z
  .object({
    addressLines: z.array(z.string()).default([]),
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
  })
  .passthrough()

const idOtherSchema = z
  .object({
    id: z.string().nullable().optional(),
    other: z.string().nullable().optional(),
  })
  .passthrough()
  .nullable()
  .optional()

const entitySchema = z
  .object({
    legalName: z.object({ name: z.string(), language: z.string().nullable().optional() }),
    otherNames: z.array(z.object({ name: z.string() }).passthrough()).default([]),
    legalAddress: addressSchema.nullable().optional(),
    headquartersAddress: addressSchema.nullable().optional(),
    registeredAt: idOtherSchema,
    registeredAs: z.string().nullable().optional(),
    jurisdiction: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    legalForm: idOtherSchema,
    status: z.string().nullable().optional(),
  })
  .passthrough()

const registrationSchema = z
  .object({
    status: z.string().nullable().optional(),
    managingLou: z.string().nullable().optional(),
  })
  .passthrough()

export const leiRecordSchema = z
  .object({
    type: z.literal("lei-records"),
    id: z.string(),
    attributes: z
      .object({
        lei: z.string(),
        entity: entitySchema,
        registration: registrationSchema,
        bic: z.array(z.string()).nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough()

/** Envelope for `/lei-records/:id`, `/…/direct-parent`, `/…/ultimate-parent`. */
export const leiRecordResponseSchema = z.object({ data: leiRecordSchema })

/** Envelope for the `/lei-records?filter[entity.legalName]=…` name search (a list). */
export const leiRecordListResponseSchema = z.object({ data: z.array(leiRecordSchema) })

const fuzzyMatchSchema = z
  .object({
    type: z.literal("fuzzycompletions"),
    attributes: z.object({ value: z.string() }),
    relationships: z
      .object({
        "lei-records": z
          .object({ data: z.object({ id: z.string() }).passthrough().nullable() })
          .optional(),
      })
      .optional(),
  })
  .passthrough()

/** Envelope for `/fuzzycompletions`. */
export const fuzzyResponseSchema = z.object({ data: z.array(fuzzyMatchSchema) })

export type LeiRecord = z.infer<typeof leiRecordSchema>
export type FuzzyMatch = z.infer<typeof fuzzyMatchSchema>

// ---- Trimmed domain types (only the valuable fields) ----

export interface GleifAddress {
  lines: string[]
  city: string | null
  region: string | null
  country: string | null
  postalCode: string | null
}

export interface GleifCompany {
  lei: string
  legalName: string
  otherNames: string[]
  jurisdiction: string | null
  entityStatus: string
  registrationStatus: string
  legalForm: string | null
  category: string | null
  registeredAs: string | null
  registeredAt: string | null
  address: GleifAddress | null
  headquartersAddress: GleifAddress | null
  bic: string[]
}

export interface GleifNameMatch {
  lei: string
  value: string
}

export interface GleifOwnershipLink {
  lei: string
  legalName: string
  jurisdiction: string | null
  /** Set by the source endpoint, not parsed: direct -> IS_DIRECTLY_CONSOLIDATED_BY, ultimate -> IS_ULTIMATELY_CONSOLIDATED_BY. */
  relationshipType: string
}

export interface GleifCompanyProfile {
  query: string
  match: { value: string; confidence: "exact" | "fuzzy" }
  company: GleifCompany
  directParent: GleifOwnershipLink | null
  ultimateParent: GleifOwnershipLink | null
}
