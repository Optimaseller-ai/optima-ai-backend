/**
 * Types légers catalogue — sans `server-only` (réutilisable côté types).
 */

export type CatalogProductBrief = {
  name: string;
  priceFcfa?: number | null;
  category?: string | null;
  stock?: number | null;
  promo?: string | null;
  descriptionSnippet?: string;
};

export type RegionBusinessStyle = "waemu_fr" | "generic";
