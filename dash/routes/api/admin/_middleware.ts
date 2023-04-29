import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { getCookies } from "https://deno.land/std@0.184.0/http/cookie.ts";
import { jwtSecretKey } from "../../../services/singleton.ts";
import * as djwt from "djwt/mod.ts";

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext,
) {
  const cookies = getCookies(req.headers);
  let jwt = cookies.admin_token;
  if(!jwt) {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response("Invalid authorization header", { status: 400 });
    }
    jwt = auth.slice(7);
  }

  try {
    await djwt.verify(jwt, jwtSecretKey);
  } catch {
    return new Response("Invalid JWT", { status: 401 });
  }

  const resp = await ctx.next();
  resp.headers.set("server", "Supernova Admin");
  return resp;
}
