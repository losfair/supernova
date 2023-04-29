import { HandlerContext, Handlers } from "$fresh/server.ts";
import { DeviceInfo } from "../../../services/types.ts";

export const handler: Handlers = {
  async GET(_req: Request, ctx: HandlerContext) {
    const deviceInfo = ctx.state.deviceInfo as DeviceInfo;
    return Response.json(deviceInfo);
  },
};
