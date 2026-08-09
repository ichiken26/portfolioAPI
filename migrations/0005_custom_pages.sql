CREATE TABLE IF NOT EXISTS custom_pages (
  slug TEXT PRIMARY KEY CHECK (slug GLOB '[a-z0-9]*' AND length(slug) <= 80),
  data TEXT NOT NULL CHECK (json_valid(data)),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS custom_pages_public_order ON custom_pages(published, sort_order);
