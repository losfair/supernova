import { useCallback, useEffect, useRef, useState } from "preact/hooks";

interface Device {
  deviceName: string;
  deviceToken: string;
  publicKey: string;
  groups: string[];
  ip: string;
  amLighthouse: boolean;
  staticAddrs: string[];
  crt: string;
  certDurationSecs?: number;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState<boolean>(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <div class="relative">
      <button
        class="bg-gray-100 border border-gray-300 px-2 py-1 rounded"
        onClick={copyToClipboard}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function SupernovaAppIsland() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string>("");
  const configForm = useRef<HTMLFormElement>(null);
  const initialFetchStarted = useRef(false);

  useEffect(() => {
    if (initialFetchStarted.current) return;
    initialFetchStarted.current = true;

    fetchDevices();
  }, []);

  async function fetchDevices() {
    try {
      const response = await fetch("/api/admin/device");
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

  async function createOrUpdateDevice(
    device: Omit<Device, "deviceToken" | "crt">,
  ) {
    try {
      const response = await fetch("/api/admin/device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(device),
      });
      if (!response.ok) {
        throw new Error("HTTP error");
      }
      await fetchDevices();
    } catch (error) {
      console.log(error);
      setError("Failed to create/update device.");
    }
  }

  async function deleteDevice(deviceName: string) {
    const ok = confirm(`Delete device '${deviceName}'?`);
    if (!ok) return;

    try {
      const response = await fetch("/api/admin/device", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Name": deviceName,
        },
      });
      if (!response.ok) {
        throw new Error("HTTP error");
      }
      await fetchDevices();
    } catch (error) {
      console.log(error);
      setError("Failed to delete device.");
    }
  }

  return (
    <>
      <div class="p-4 mx-auto max-w-screen-lg">
        {error && <p class="my-6 text-red-500">{error}</p>}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createOrUpdateDevice({
              deviceName: event.currentTarget.deviceName.value,
              publicKey: event.currentTarget.publicKey.value,
              groups: (event.currentTarget.groups.value as string).split(",")
                .filter((x) => x),
              ip: event.currentTarget.ip.value,
              amLighthouse: event.currentTarget.amLighthouse.checked,
              certDurationSecs: event.currentTarget.certDurationSecs.value
                ? parseInt(
                  event.currentTarget.certDurationSecs.value,
                )
                : undefined,
              staticAddrs: (event.currentTarget.staticAddrs.value as string)
                .split(",").filter((x) => x),
            });
          }}
          ref={configForm}
        >
          <div class="my-6">
            <label class="block font-medium mb-2" for="deviceName">
              Device Name
            </label>
            <input
              class="w-full border-gray-300 rounded-md shadow-sm"
              type="text"
              id="deviceName"
              required
            />
          </div>
          <div class="my-6">
            <label class="block font-medium mb-2" for="publicKey">
              Public Key
            </label>
            <textarea
              class="w-full border-gray-300 rounded-md shadow-sm"
              id="publicKey"
              required
            >
            </textarea>
          </div>
          <div class="my-6">
            <label class="block font-medium mb-2" for="groups">
              Groups
            </label>
            <input
              class="w-full border-gray-300 rounded-md shadow-sm"
              type="text"
              id="groups"
            />
          </div>
          <div class="my-6">
            <label class="block font-medium mb-2" for="ip">
              IP
            </label>
            <input
              class="w-full border-gray-300 rounded-md shadow-sm"
              type="text"
              id="ip"
              required
            />
          </div>
          <div class="my-6">
            <label class="block font-medium mb-2" for="amLighthouse">
              Is Lighthouse
            </label>
            <input
              class="border-gray-300 rounded-md shadow-sm"
              type="checkbox"
              id="amLighthouse"
            />
          </div>
          <div class="my-6">
            <label class="block font-medium mb-2" for="staticAddrs">
              Static Addresses
            </label>
            <input
              class="w-full border-gray-300 rounded-md shadow-sm"
              type="text"
              id="staticAddrs"
            />
          </div>
          <div class="my-6">
            <label class="block font-medium mb-2" for="certDurationSecs">
              Cert Duration (seconds, optional)
            </label>
            <input
              class="w-full border-gray-300 rounded-md shadow-sm"
              type="text"
              id="certDurationSecs"
            />
          </div>
          <button
            class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md shadow-sm"
            type="submit"
          >
            Create/Update Device
          </button>
        </form>
        <table class="table-auto my-6">
          <thead>
            <tr>
              <th class="px-4 py-2">Device Name</th>
              <th class="px-4 py-2">Token</th>
              <th class="px-4 py-2">Crt</th>
              <th class="px-4 py-2">Groups</th>
              <th class="px-4 py-2">IP Address</th>
              <th class="px-4 py-2">Lighthouse?</th>
              <th class="px-4 py-2">Static Addresses</th>
              <th class="px-4 py-2">Edit</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.deviceName}>
                <td class="border px-4 py-2">{device.deviceName}</td>
                <td class="border px-4 py-2">
                  <CopyButton value={device.deviceToken} />
                </td>
                <td class="border px-4 py-2">
                  <CopyButton value={device.crt} />
                </td>
                <td class="border px-4 py-2">{device.groups.join(", ")}</td>
                <td class="border px-4 py-2">{device.ip}</td>
                <td class="border px-4 py-2">
                  {device.amLighthouse ? "Yes" : "No"}
                </td>
                <td class="border px-4 py-2">
                  {device.staticAddrs.join(", ")}
                </td>
                <td class="border px-4 py-2">
                  <button
                    onClick={() => {
                      configForm.current!.deviceName.value = device.deviceName;
                      configForm.current!.publicKey.value = device.publicKey;
                      configForm.current!.groups.value = device.groups.join(
                        ",",
                      );
                      configForm.current!.ip.value = device.ip;
                      configForm.current!.amLighthouse.checked =
                        device.amLighthouse;
                      configForm.current!.certDurationSecs.value = "";
                      configForm.current!.staticAddrs.value = device.staticAddrs
                        .join(",");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      deleteDevice(device.deviceName);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
