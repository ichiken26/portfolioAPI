import { z } from "zod";

const safeUrl = z.union([z.literal(""), z.string().url().refine((v) => ["http:", "https:"].includes(new URL(v).protocol), "HTTP(S) URL only")]);
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
export const aboutBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(80), title: z.string().min(1).max(100), type: z.literal("text"), text: z.string().max(20000) }),
  z.object({ id: z.string().min(1).max(80), title: z.string().min(1).max(100), type: z.literal("list"), items: z.array(z.string().max(1000)).max(100) }),
  z.object({ id: z.string().min(1).max(80), title: z.string().min(1).max(100), type: z.literal("links"), items: z.array(z.object({ label: z.string().max(200), url: safeUrl })).max(100) }),
  z.object({ id: z.string().min(1).max(80), title: z.string().min(1).max(100), type: z.literal("table"), rows: z.array(z.object({ label: z.string().max(200), value: z.string().max(2000) })).max(100) }),
]);
export const aboutSchema = z.object({ overview: z.string().max(30000), blocks: z.array(aboutBlockSchema).max(50) });
export const techSchema = z.object({ categories: z.array(z.object({ id: z.string().min(1).max(80), name: z.string().min(1).max(100), items: z.array(z.object({ id: z.string().min(1).max(80), name: z.string().min(1).max(100), level: z.string().max(50), tags: z.array(z.string().max(50)).max(30) })).max(100) })).max(50) });
export const productSchema = z.object({
  slug: slugSchema, title: z.string().min(1).max(160), summary: z.string().max(3000), type: z.string().max(80),
  status: z.enum(["構想中", "制作中", "公開中"]), tags: z.array(z.string().max(50)).max(50), imagePath: z.string().max(500), dummyColor: z.enum(["blue", "green", "red", "yellow"]),
  liveUrl: safeUrl, githubUrls: z.array(safeUrl).max(20), body: z.string().max(200000), published: z.boolean(), order: z.number().int().min(0).max(100000), version: z.number().int().nonnegative().optional()
});
export const productsPageSchema = z.object({ title: z.string().min(1).max(160), summary: z.string().max(3000), published: z.boolean(), version: z.number().int().nonnegative().optional() });
export const contentUpdateSchema = z.object({ data: z.unknown(), published: z.boolean(), version: z.number().int().nonnegative() });
