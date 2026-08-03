CREATE TABLE IF NOT EXISTS content (
  kind TEXT PRIMARY KEY CHECK (kind IN ('about','tech-stack','products')),
  data TEXT NOT NULL CHECK (json_valid(data)), published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  slug TEXT PRIMARY KEY CHECK (slug GLOB '[a-z0-9]*' AND length(slug) <= 80),
  data TEXT NOT NULL CHECK (json_valid(data)), published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS products_public_order ON products(published, sort_order);
