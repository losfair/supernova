import { HandlerContext, Handlers } from "$fresh/server.ts";
import { deviceModel } from "../../../services/singleton.ts";
import { DeviceInfo } from "../../../services/types.ts";
import * as yaml from "std/yaml/mod.ts";
import { z } from "zod/mod.ts";
import { nebulaCaCrt } from "../../../services/env.ts";

const inputSchema = z.object({
  configOverride: z.string().or(z.record(z.unknown())).default({}),
});

export const handler: Handlers = {
  async POST(req: Request, ctx: HandlerContext) {
    const deviceInfo = ctx.state.deviceInfo as DeviceInfo;
    const body = inputSchema.parse(await req.json());
    const configOverride = typeof body.configOverride === "string"
      ? (yaml.parse(body.configOverride) ?? {})
      : body.configOverride;

    const allDevices = await deviceModel.listDevices();
    const staticHosts = allDevices.filter((x) => x.staticAddrs.length !== 0);
    const lighthouses = allDevices.filter((x) => x.amLighthouse);

    const generated = {
      pki: {
        ca: nebulaCaCrt,
        cert: deviceInfo.crt,
      },
      static_host_map: Object.fromEntries(
        staticHosts.map((x) => [x.ip.split("/")[0], x.staticAddrs]),
      ),
      lighthouse: {
        am_lighthouse: deviceInfo.amLighthouse,
        interval: 60,
        hosts: lighthouses.map((x) => x.ip.split("/")[0]),
      },
      listen: {
        host: "[::]",
        port: deviceInfo.staticAddrs.length
          ? parseInt(deviceInfo.staticAddrs[0].split(":")[1] ?? "0")
          : 0,
      },
      punchy: {
        punch: true,
        respond: true,
      },
      cipher: "aes",
      tun: {
        disabled: false,
        dev: "supernova",
        drop_local_broadcast: false,
        drop_multicast: false,
        tx_queue: 500,
        mtu: 1300,
      },
      relay: {
        relays: lighthouses.map((x) => x.ip.split("/")[0]),
        am_relay: deviceInfo.amLighthouse,
        use_relays: false,
      },
      logging: {
        level: "info",
        format: "text",
      },
      firewall: {
        outbound_action: "drop",
        inbound_action: "drop",
        conntrack: {
          tcp_timeout: "12m",
          udp_timeout: "3m",
          default_timeout: "10m",
        },
        outbound: [
          {
            port: "any",
            proto: "any",
            host: "any",
          },
        ],
        inbound: [
          {
            port: "any",
            proto: "icmp",
            host: "any",
          },
        ],
      },
    };
    return Response.json({
      config: yaml.stringify(
        deepMergeConfig(generated, configOverride) as Record<string, unknown>,
      ),
    });
  },
};

// deno-lint-ignore no-explicit-any
function deepMergeConfig(base: any, override: any): unknown {
  if (
    typeof base !== "object" || typeof override !== "object" ||
    base === null || override === null
  ) {
    return override;
  }
  if (Array.isArray(base) || Array.isArray(override)) {
    return override;
  }

  // deno-lint-ignore no-explicit-any
  const result: any = {};
  for (const key of Object.keys(base)) {
    if (key in override) {
      result[key] = deepMergeConfig(base[key], override[key]);
    } else {
      result[key] = base[key];
    }
  }
  for (const key of Object.keys(override)) {
    if (!(key in base)) {
      result[key] = override[key];
    }
  }
  return result;
}
