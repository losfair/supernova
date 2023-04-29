import { HandlerContext, Handlers } from "$fresh/server.ts";
import { AwsServiceError } from "https://deno.land/x/aws_api@v0.8.1/client/mod.ts";
import { deviceModel } from "../../../services/singleton.ts";
import { deviceInputSchema } from "../../../services/types.ts";

export const handler: Handlers = {
  async POST(req: Request, _ctx: HandlerContext) {
    const body = deviceInputSchema.parse(await req.json());
    const info = await deviceModel.addDevice(body);
    return Response.json(info);
  },
  async GET(_req: Request, _ctx: HandlerContext) {
    const devices = await deviceModel.listDevices();
    return Response.json(devices);
  },
  async DELETE(req: Request, _ctx: HandlerContext) {
    const deviceName = req.headers.get("x-device-name") ?? "";
    await deviceModel.deleteDevice(deviceName);
    return Response.json({ success: true });
  },
};
