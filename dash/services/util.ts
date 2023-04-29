export function getDeviceAuthInfo(
  req: Request,
): { deviceName: string; deviceToken: string } | null {
  const deviceName = req.headers.get("x-device-name");
  const authorization = req.headers.get("authorization")?.toLowerCase();

  if (!deviceName || !authorization?.startsWith("bearer ")) {
    return null;
  }

  const deviceToken = authorization.slice(7);
  return { deviceName, deviceToken };
}
