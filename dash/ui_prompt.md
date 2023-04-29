Please write a frontend app using TypeScript, Preact and Tailwind. A minimal example looks like this:

```tsx
import { Head } from "$fresh/runtime.ts";

export default function Home() {
  return (
    <>
      <Head>
        <title>Fresh App</title>
      </Head>
      <div class="p-4 mx-auto max-w-screen-md">
        <img
          src="/logo.svg"
          class="w-32 h-32"
          alt="the fresh logo: a sliced lemon dripping with juice"
        />
        <p class="my-6">
          Welcome to `fresh`. Try updating this message in the ./routes/index.tsx
          file, and refresh.
        </p>
      </div>
    </>
  );
}
```

The frontend app is a management UI for a overlay network SaaS called Supernova. The backend API is as following:

- GET /api/admin/device: list all devices in the network
- POST /api/admin/device: create a new device or update an existing device

Example request for POST /api/admin/device:

```json
{
  "deviceName": "my-device",
  "publicKey": "example-public-key",
  "groups": ["server", "lighthouse"],
  "ip": "192.168.100.1/24",
  "amLighthouse": true,
  "staticAddrs": ["8.8.8.8:4242"]
}
```

Example response for GET /api/admin/device:

```json
[
  {
    "deviceName": "my-device",
    "publicKey": "example-public-key",
    "groups": ["server", "lighthouse"],
    "ip": "192.168.100.1/24",
    "amLighthouse": true,
    "staticAddrs": ["8.8.8.8:4242"]
  }
]
```

All requests to the API should carry the `Authorization` header:

```
Authorization: Bearer my-jwt
```

The JWT should be taken from user input.


---

Please improve this TypeScript+Preact+Tailwind app to look better by displaying the device list in a tabular format.

```tsx
import { useState } from "preact/hooks"

interface Device {
  deviceName: string;
  publicKey: string;
  groups: string[];
  ip: string;
  amLighthouse: boolean;
  staticAddrs: string[];
}

export default function SupernovaAppIsland() {
  const [devices, setDevices] = useState<Device[]>([]);

  async function fetchDevices() {
    try {
      const response = await fetch("/api/admin/device", {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (!response.ok) {
        throw new Error("HTTP error");
      }
      const json = await response.json();
      setDevices(json);
    } catch (error) {
      console.log(error);
      setError("Failed to fetch devices.");
    }
  }

  return (
    <>
      <div class="p-4 mx-auto max-w-screen-md">
        {error && <p class="my-6 text-red-500">{error}</p>}
        <ul class="my-6">
          {devices.map((device) => (
            <li>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                }}
              >{JSON.stringify(device, undefined, 2)}</pre>
            </li>
          ))}
        </ul>
        <button
          class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md shadow-sm"
          onClick={() => fetchDevices()}
        >
          Refresh Devices
        </button>
      </div>
    </>
  );
}
```
