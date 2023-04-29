import { z } from "zod/mod.ts";

export const deviceInputSchema = z.object({
  deviceName: z.string().min(1).max(36).regex(/^[a-z0-9-]+$/),
  publicKey: z.string(),
  groups: z.array(z.string()),
  ip: z.string(),
  amLighthouse: z.boolean().default(false),
  staticAddrs: z.array(z.string()).default([]),
  certDurationSecs: z.number().int().gt(0).optional(),
});

export type DeviceInput = z.infer<typeof deviceInputSchema>;

export type DeviceInfo = DeviceInput & {
  deviceToken: string;
  crt: string;
  renewableAt: number;
};
