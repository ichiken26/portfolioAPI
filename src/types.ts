export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ALLOWED_ORIGINS: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  DEV_AUTH_BYPASS?: string;
}

export type ContentKind = "about" | "tech-stack" | "products";
