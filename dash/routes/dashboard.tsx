import { Head } from "$fresh/runtime.ts";
import { HandlerContext } from "$fresh/server.ts";
import { getCookies } from "https://deno.land/std@0.184.0/http/cookie.ts";
import SupernovaAppIsland from "../islands/SupernovaAppIsland.tsx";

export const handler = (
  req: Request,
  ctx: HandlerContext,
): Response | Promise<Response> => {
  const cookies = getCookies(req.headers);

  // do not perform validation here - delegate to api
  if (!cookies.admin_token) {
    return new Response(null, {
      headers: {
        location: `/api/auth/github`,
      },
      status: 302,
    });
  }

  return ctx.render();
};

export default function SupernovaApp() {
  return (
    <>
      <Head>
        <title>Supernova App</title>
      </Head>
      <SupernovaAppIsland />
    </>
  );
}
