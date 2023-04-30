import * as base64 from "std/encoding/base64.ts";

export const nebulaCaCrt = new TextDecoder().decode(
  base64.decode(Deno.env.get("NEBULA_CA_CRT_B64") ?? ""),
);
