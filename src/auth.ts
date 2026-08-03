import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./types";

export const requireAccess: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const host = new URL(c.req.url).hostname;
  if (c.env.DEV_AUTH_BYPASS === "true" && ["localhost", "127.0.0.1"].includes(host)) return next();
  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token || !c.env.ACCESS_TEAM_DOMAIN || !c.env.ACCESS_AUD) return c.json({ error: { code: "UNAUTHORIZED", message: "Cloudflare Access authentication required" } }, 401);
  const issuer = `https://${c.env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  try {
    await jwtVerify(token, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)), { issuer, audience: c.env.ACCESS_AUD, algorithms: ["RS256"] });
    return next();
  } catch {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid Cloudflare Access token" } }, 401);
  }
};
