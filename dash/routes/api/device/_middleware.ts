import { MiddlewareHandlerContext } from "$fresh/server.ts";
import { deviceModel } from "../../../services/singleton.ts";
import { getDeviceAuthInfo } from "../../../services/util.ts";

export async function handler(
  req: Request,
  ctx: MiddlewareHandlerContext,
) {
  const authInfo = getDeviceAuthInfo(req);
  if (!authInfo) {
    return Response.json({ error: "invalid auth info" }, { status: 400 });
  }
  const info = await deviceModel.getDevice(authInfo.deviceName);
  if (!info || info.deviceToken !== authInfo.deviceToken) {
    return Response.json({ error: "auth failed" }, { status: 401 });
  }

  ctx.state.deviceInfo = info;

  const resp = await ctx.next();
  resp.headers.set("server", "Supernova Device");
  return resp;
}
