import { describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { productSchema, slugSchema } from "../src/schemas";

const env = { ALLOWED_ORIGINS:"https://kokage-studio.com", ACCESS_TEAM_DOMAIN:"team.cloudflareaccess.com", ACCESS_AUD:"aud", DEV_AUTH_BYPASS:"true",
  DB: {} as D1Database, IMAGES:{ put:vi.fn(), get:vi.fn(), delete:vi.fn() } as unknown as R2Bucket };
describe("API",()=>{
  it("returns health",async()=>expect((await app.request("http://localhost/api/v1/health",{},env)).status).toBe(200));
  it("only allows configured CORS origins",async()=>{const ok=await app.request("http://localhost/api/v1/health",{headers:{Origin:"https://kokage-studio.com"}},env);expect(ok.headers.get("access-control-allow-origin")).toBe("https://kokage-studio.com");const bad=await app.request("http://localhost/api/v1/health",{headers:{Origin:"https://evil.example"}},env);expect(bad.headers.get("access-control-allow-origin")).toBeNull()});
  it("rejects malformed slugs and unsafe URLs",()=>{expect(slugSchema.safeParse("../bad").success).toBe(false);expect(productSchema.safeParse({slug:"safe",title:"x",summary:"",type:"Web",status:"公開中",tags:[],imagePath:"",dummyColor:"green",liveUrl:"javascript:alert(1)",githubUrls:[],body:"",published:true,order:0}).success).toBe(false)});
  it("requires Access outside localhost",async()=>{const res=await app.request("https://api.example/api/v1/admin/products",{},env);expect(res.status).toBe(401)});
  it("rejects image content that does not match MIME",async()=>{const form=new FormData();form.append("file",new File(["not png"],"x.png",{type:"image/png"}));const res=await app.request("http://localhost/api/v1/admin/images",{method:"POST",body:form},env);expect(res.status).toBe(415)});
});
