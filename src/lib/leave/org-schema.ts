import { z } from "zod";

/**
 * The query of `GET /api/org/children` (EPIC-11, TASK-063). `parent` is only the person whose reports are
 * wanted, a lookup key and never an identity; `page` is 1-based and is clamped by the read itself. A new file,
 * not an addition to `schemas.ts`, which most of the leave code imports.
 */
export const orgChildrenQuerySchema = z.object({
  parent: z.uuid(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export type OrgChildrenQuery = z.infer<typeof orgChildrenQuerySchema>;
