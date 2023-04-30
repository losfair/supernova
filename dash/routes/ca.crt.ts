import { HandlerContext, Handlers } from "$fresh/server.ts";
import { nebulaCaCrt } from "../services/env.ts";

export const handler: Handlers = {
  GET(_req: Request, _ctx: HandlerContext): Response {
    return new Response(nebulaCaCrt, {
      headers: {
        "Content-Type": "application/x-pem-file",
      },
    });
  },
};
