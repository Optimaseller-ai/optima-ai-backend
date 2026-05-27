/**
 * Types légers catalogue — sans `server-only` (réutilisable côté types).
 */

export type CatalogProductBrief = {
  /** Optional DB id if available. */
  id?: string;
  name: string;
  priceFcfa?: number | null;
  category?: string | null;
  stock?: number | null;
  promo?: string | null;
  descriptionSnippet?: string;
  /** Optional merchandising fields when available in DB/RPC. */
  tags?: string[] | null;
  thumbnailUrl?: string | null;
  imageUrls?: string[] | null;
  popularity01?: number | null;
  margin01?: number | null;
  sponsored?: boolean | null;
};

export type RegionBusinessStyle = "waemu_fr" | "generic";
