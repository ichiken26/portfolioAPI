import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { requireAccess } from "./auth";
import { aboutSchema, contentUpdateSchema, customPageSchema, pageSlugSchema, productSchema, productsPageSchema, slugSchema, techSchema } from "./schemas";
import type { ContentKind, Env } from "./types";

const app = new Hono<{ Bindings: Env }>();
const api = new Hono<{ Bindings: Env }>();
const kinds = new Set<ContentKind>(["about", "tech-stack", "products"]);
const parse = <T>(value: string): T => JSON.parse(value) as T;
const contentSchema = (kind: ContentKind) => kind === "about" ? aboutSchema : kind === "tech-stack" ? techSchema : productsPageSchema.omit({ published: true, version: true });

app.use("*", secureHeaders());
app.use("*", async (c, next) => cors({
  origin: (origin) => c.env.ALLOWED_ORIGINS.split(",").map((v) => v.trim()).includes(origin) ? origin : "",
  allowMethods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "If-Match", "Cf-Access-Jwt-Assertion"], exposeHeaders: ["ETag"], maxAge: 86400,
})(c, next));
app.onError((error, c) => {
  if (error instanceof ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", issues: error.issues } }, 400);
  console.error(error);
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }, 500);
});

api.get("/health", (c) => c.json({ status: "ok" }));
api.get("/content/:kind", async (c) => {
  const kind = c.req.param("kind") as ContentKind;
  if (!kinds.has(kind)) return c.json({ error: { code: "NOT_FOUND", message: "Content not found" } }, 404);
  const row = await c.env.DB.prepare("SELECT data, version, updated_at FROM content WHERE kind = ? AND published = 1").bind(kind).first<{ data: string; version: number; updated_at: string }>();
  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Content not published" } }, 404);
  c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
  return c.json({ data: parse(row.data), published: true, version: row.version, updatedAt: row.updated_at });
});
api.get("/products", async (c) => {
  const result = await c.env.DB.prepare("SELECT slug, data, version, updated_at FROM products WHERE published = 1 AND EXISTS (SELECT 1 FROM content WHERE kind = 'products' AND published = 1) ORDER BY sort_order, slug").all<{ slug: string; data: string; version: number; updated_at: string }>();
  c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
  return c.json({ products: result.results.map((r) => ({ ...parse<Record<string, unknown>>(r.data), slug: r.slug, version: r.version, updatedAt: r.updated_at })) });
});
api.get("/products/:slug", async (c) => {
  const slug = slugSchema.safeParse(c.req.param("slug"));
  if (!slug.success) return c.json({ error: { code: "NOT_FOUND", message: "Product not found" } }, 404);
  const row = await c.env.DB.prepare("SELECT data, version, updated_at FROM products WHERE slug = ? AND published = 1 AND EXISTS (SELECT 1 FROM content WHERE kind = 'products' AND published = 1)").bind(slug.data).first<{ data: string; version: number; updated_at: string }>();
  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Product not found" } }, 404);
  return c.json({ ...parse<Record<string, unknown>>(row.data), slug: slug.data, published: true, version: row.version, updatedAt: row.updated_at });
});
api.get("/images/:key", async (c) => {
  const key = c.req.param("key");
  if (!/^[a-f0-9-]{36}\.(?:jpg|png|gif)$/.test(key)) return c.notFound();
  const object = await c.env.IMAGES.get(key);
  if (!object) return c.notFound();
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
});
api.get("/pages", async (c) => {
  const result = await c.env.DB.prepare("SELECT slug, data, sort_order FROM custom_pages WHERE published = 1 ORDER BY sort_order, slug").all<{ slug: string; data: string; sort_order: number }>();
  c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
  return c.json({ pages: result.results.map((row) => { const data = parse<{ title: string; navLabel: string; description: string }>(row.data); return { slug: row.slug, title: data.title, navLabel: data.navLabel, description: data.description, order: row.sort_order }; }) });
});
api.get("/pages/:slug", async (c) => {
  const slug = pageSlugSchema.safeParse(c.req.param("slug"));
  if (!slug.success) return c.notFound();
  const row = await c.env.DB.prepare("SELECT data, version, updated_at, sort_order FROM custom_pages WHERE slug = ? AND published = 1").bind(slug.data).first<{ data: string; version: number; updated_at: string; sort_order: number }>();
  if (!row) return c.notFound();
  c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
  return c.json({ ...parse<Record<string, unknown>>(row.data), slug: slug.data, published: true, order: row.sort_order, version: row.version, updatedAt: row.updated_at });
});

api.use("/admin/*", requireAccess);
api.get("/admin/content/:kind", async (c) => {
  const kind = c.req.param("kind") as ContentKind;
  if (!kinds.has(kind)) return c.json({ error: { code: "NOT_FOUND", message: "Content not found" } }, 404);
  const row = await c.env.DB.prepare("SELECT data, published, version, updated_at FROM content WHERE kind = ?").bind(kind).first<{ data: string; published: number; version: number; updated_at: string }>();
  if (!row) return c.notFound();
  c.header("ETag", `"${row.version}"`);
  return c.json({ data: parse(row.data), published: Boolean(row.published), version: row.version, updatedAt: row.updated_at });
});
api.put("/admin/content/:kind", async (c) => {
  const kind = c.req.param("kind") as ContentKind;
  if (!kinds.has(kind)) return c.notFound();
  const input = contentUpdateSchema.parse(await c.req.json());
  const data = contentSchema(kind).parse(input.data);
  const result = await c.env.DB.prepare("UPDATE content SET data = ?, published = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE kind = ? AND version = ?").bind(JSON.stringify(data), input.published ? 1 : 0, kind, input.version).run();
  if (result.meta.changes !== 1) return c.json({ error: { code: "VERSION_CONFLICT", message: "Content was changed elsewhere; reload before saving" } }, 409);
  return c.json({ data, published: input.published, version: input.version + 1 });
});
api.get("/admin/products", async (c) => {
  const result = await c.env.DB.prepare("SELECT slug, data, published, version, updated_at FROM products ORDER BY sort_order, slug").all<{ slug: string; data: string; published: number; version: number; updated_at: string }>();
  return c.json({ products: result.results.map((r) => ({ ...parse<Record<string, unknown>>(r.data), slug: r.slug, published: Boolean(r.published), version: r.version, updatedAt: r.updated_at })) });
});
api.get("/admin/products/:slug", async (c) => {
  const slug = slugSchema.parse(c.req.param("slug"));
  const row = await c.env.DB.prepare("SELECT data, published, version, updated_at FROM products WHERE slug = ?").bind(slug).first<{ data: string; published: number; version: number; updated_at: string }>();
  if (!row) return c.notFound();
  return c.json({ ...parse<Record<string, unknown>>(row.data), slug, published: Boolean(row.published), version: row.version, updatedAt: row.updated_at });
});
api.post("/admin/products", async (c) => {
  const product = productSchema.parse(await c.req.json());
  const data = { title: product.title, summary: product.summary, type: product.type, status: product.status, tags: product.tags, imagePath: product.imagePath, dummyColor: product.dummyColor, liveUrl: product.liveUrl, githubUrls: product.githubUrls, body: product.body };
  const { slug, published, order } = product;
  const result = await c.env.DB.prepare("INSERT OR IGNORE INTO products (slug, data, published, sort_order) VALUES (?, ?, ?, ?)").bind(slug, JSON.stringify(data), published ? 1 : 0, order).run();
  if (result.meta.changes !== 1) return c.json({ error: { code: "ALREADY_EXISTS", message: "Slug already exists" } }, 409);
  return c.json({ ...product, version: 0 }, 201);
});
api.put("/admin/products/:slug", async (c) => {
  const currentSlug = slugSchema.parse(c.req.param("slug"));
  const product = productSchema.parse(await c.req.json());
  if (product.slug !== currentSlug) return c.json({ error: { code: "IMMUTABLE_SLUG", message: "Slug cannot be changed" } }, 400);
  const { slug, published, order, version = 0, ...data } = product;
  const result = await c.env.DB.prepare("UPDATE products SET data = ?, published = ?, sort_order = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE slug = ? AND version = ?").bind(JSON.stringify(data), published ? 1 : 0, order, slug, version).run();
  if (result.meta.changes !== 1) return c.json({ error: { code: "VERSION_CONFLICT", message: "Product was changed elsewhere; reload before saving" } }, 409);
  return c.json({ ...product, version: version + 1 });
});
api.delete("/admin/products/:slug", async (c) => {
  const slug = slugSchema.parse(c.req.param("slug"));
  const result = await c.env.DB.prepare("DELETE FROM products WHERE slug = ?").bind(slug).run();
  return result.meta.changes ? c.body(null, 204) : c.notFound();
});
api.post("/admin/images", async (c) => {
  const body = await c.req.parseBody({ all: false });
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: { code: "VALIDATION_ERROR", message: "Image file required" } }, 400);
  const formats: Record<string, { ext: string; signature: (b: Uint8Array) => boolean }> = {
    "image/jpeg": { ext: "jpg", signature: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    "image/png": { ext: "png", signature: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
    "image/gif": { ext: "gif", signature: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  };
  const format = formats[file.type];
  if (!format || file.size > 5 * 1024 * 1024) return c.json({ error: { code: "INVALID_IMAGE", message: "JPEG, PNG or GIF up to 5 MiB required" } }, 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!format.signature(bytes)) return c.json({ error: { code: "INVALID_IMAGE", message: "File signature does not match media type" } }, 415);
  const key = `${crypto.randomUUID()}.${format.ext}`;
  await c.env.IMAGES.put(key, bytes, { httpMetadata: { contentType: file.type }, customMetadata: { uploadedAt: new Date().toISOString() } });
  return c.json({ key, url: `/api/v1/images/${key}` }, 201);
});
api.delete("/admin/images/:key", async (c) => {
  const key = c.req.param("key");
  if (!/^[a-f0-9-]{36}\.(?:jpg|png|gif)$/.test(key)) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid image key" } }, 400);
  await c.env.IMAGES.delete(key);
  return c.body(null, 204);
});
api.get("/admin/pages", async (c) => {
  const result = await c.env.DB.prepare("SELECT slug, data, published, sort_order, version, updated_at FROM custom_pages ORDER BY sort_order, slug").all<{ slug: string; data: string; published: number; sort_order: number; version: number; updated_at: string }>();
  return c.json({ pages: result.results.map((row) => ({ ...parse<Record<string, unknown>>(row.data), slug: row.slug, published: Boolean(row.published), order: row.sort_order, version: row.version, updatedAt: row.updated_at })) });
});
api.get("/admin/pages/:slug", async (c) => {
  const slug = pageSlugSchema.parse(c.req.param("slug"));
  const row = await c.env.DB.prepare("SELECT data, published, sort_order, version, updated_at FROM custom_pages WHERE slug = ?").bind(slug).first<{ data: string; published: number; sort_order: number; version: number; updated_at: string }>();
  if (!row) return c.notFound();
  return c.json({ ...parse<Record<string, unknown>>(row.data), slug, published: Boolean(row.published), order: row.sort_order, version: row.version, updatedAt: row.updated_at });
});
api.post("/admin/pages", async (c) => {
  const page = customPageSchema.parse(await c.req.json());
  const { slug, published, order, ...data } = page;
  const result = await c.env.DB.prepare("INSERT OR IGNORE INTO custom_pages (slug, data, published, sort_order) VALUES (?, ?, ?, ?)").bind(slug, JSON.stringify(data), published ? 1 : 0, order).run();
  if (result.meta.changes !== 1) return c.json({ error: { code: "ALREADY_EXISTS", message: "Slug already exists" } }, 409);
  return c.json({ ...page, version: 0 }, 201);
});
api.put("/admin/pages/:slug", async (c) => {
  const currentSlug = pageSlugSchema.parse(c.req.param("slug"));
  const page = customPageSchema.parse(await c.req.json());
  if (page.slug !== currentSlug) return c.json({ error: { code: "IMMUTABLE_SLUG", message: "Slug cannot be changed" } }, 400);
  const { slug, published, order, version = 0, ...data } = page;
  const result = await c.env.DB.prepare("UPDATE custom_pages SET data = ?, published = ?, sort_order = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE slug = ? AND version = ?").bind(JSON.stringify(data), published ? 1 : 0, order, slug, version).run();
  if (result.meta.changes !== 1) return c.json({ error: { code: "VERSION_CONFLICT", message: "Page was changed elsewhere; reload before saving" } }, 409);
  return c.json({ ...page, version: version + 1 });
});
api.delete("/admin/pages/:slug", async (c) => {
  const slug = pageSlugSchema.parse(c.req.param("slug"));
  const result = await c.env.DB.prepare("DELETE FROM custom_pages WHERE slug = ?").bind(slug).run();
  return result.meta.changes ? c.body(null, 204) : c.notFound();
});

app.route("/api/v1", api);
export default app;
