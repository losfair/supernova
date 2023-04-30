import "std/dotenv/load.ts";
import { assert, assertEquals } from "std/testing/asserts.ts";
import { ApiFactory, AwsServiceError } from "aws_api/client/mod.ts";
import { DynamoDB } from "aws_api/services/dynamodb/mod.ts";
import { Lambda } from "aws_api/services/lambda/mod.ts";
import { certsvcLambdaClient } from "../services/singleton.ts";

export const ddbClient = new ApiFactory({
  fixedEndpoint: Deno.env.get("DDB_ENDPOINT"),
}).makeNew(DynamoDB);

export const certsvcClient = new ApiFactory({
  fixedEndpoint: Deno.env.get("CERTSVC_LAMBDA_ENDPOINT"),
}).makeNew(Lambda);

// signed '{}' with HS256 "verysecuresecret"
const adminAuthHeader =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.Y2nQzy4gFtkBilJa5FpJiwhznuL89B4vIjjV-06n_GY";

// signed '{}' with HS256 "badsecret"
const adminBadAuthHeader =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tO02VKOBVTVjD5ilqpHA8TjHujamTk3D8JX_a4TJbrQ";

const TEST_PUB = `-----BEGIN NEBULA X25519 PUBLIC KEY-----
urI9hrdWAOXX8nCNu47eghYNizTjZ3z736UolOG7WFI=
-----END NEBULA X25519 PUBLIC KEY-----`;

const TEST_KEY = `-----BEGIN NEBULA X25519 PRIVATE KEY-----
nuLC9P9/TTLy4FN4VPHjH9UGwBpwl7ZoG3DZsIajwAc=
-----END NEBULA X25519 PRIVATE KEY-----`;

// Ensure table existence
try {
  await ddbClient.deleteTable({
    TableName: Deno.env.get("DEVICE_TABLE_NAME")!,
  });
} catch (e) {
  if (
    e instanceof AwsServiceError && e.shortCode === "ResourceNotFoundException"
  ) {
    // does not exist
  } else throw e;
}
await ddbClient.createTable({
  TableName: Deno.env.get("DEVICE_TABLE_NAME")!,
  AttributeDefinitions: [{
    AttributeName: "deviceName",
    AttributeType: "S",
  }],
  KeySchema: [
    {
      AttributeName: "deviceName",
      KeyType: "HASH",
    },
  ],
  BillingMode: "PAY_PER_REQUEST",
});

Deno.test("device test", async () => {
  const deviceName = crypto.randomUUID();

  // Admin create
  let res = await fetch(`http://localhost:8000/api/admin/device`, {
    method: "POST",
    body: JSON.stringify({
      deviceName,
      publicKey: TEST_PUB,
      groups: ["server", "lighthouse"],
      ip: "192.168.100.1/24",
      amLighthouse: true,
      staticAddrs: ["8.8.8.8:4242"],
    }),
    headers: {
      "content-type": "application/json",
      "authorization": adminAuthHeader,
    },
  });
  assertEquals(res.status, 200);
  const createResponse = await res.json();
  createResponse.groups.sort();

  assert(createResponse.crt.startsWith("-----BEGIN NEBULA CERTIFICATE-----\n"));

  // Admin list
  res = await fetch(`http://localhost:8000/api/admin/device`, {
    headers: {
      "accept": "application/json",
      "authorization": adminAuthHeader,
    },
  });
  assertEquals(res.status, 200);
  const listResponse = await res.json();
  assertEquals(listResponse.length, 1);
  listResponse[0].groups.sort();
  assertEquals(listResponse[0], createResponse);

  // Admin list with invalid creds
  res = await fetch(`http://localhost:8000/api/admin/device`, {
    headers: {
      "accept": "application/json",
      "authorization": adminBadAuthHeader,
    },
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();

  // Device get
  res = await fetch(`http://localhost:8000/api/device/info`, {
    headers: {
      "authorization": `Bearer ${createResponse.deviceToken}`,
      "x-device-name": deviceName,
    },
  });
  assertEquals(res.status, 200);
  const getResponse = await res.json();

  getResponse.groups.sort();
  assertEquals(getResponse, createResponse);

  // Device get auth failure
  res = await fetch(`http://localhost:8000/api/device/info`, {
    headers: {
      "authorization": `Bearer abcd`,
      "x-device-name": deviceName,
    },
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();

  // Device config
  res = await fetch(`http://localhost:8000/api/device/config`, {
    method: "POST",
    body: JSON.stringify({}),
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${createResponse.deviceToken}`,
      "x-device-name": deviceName,
    },
  });
  assertEquals(res.status, 200);
  const _configResponse = await res.json();
  //console.log(configResponse.config);

  // Delete device
  res = await fetch(`http://localhost:8000/api/admin/device`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "authorization": adminAuthHeader,
      "x-device-name": deviceName,
    },
  });
  assertEquals(res.status, 200);
  await res.body?.cancel();

  // Now the device should disappear
  res = await fetch(`http://localhost:8000/api/device/config`, {
    method: "POST",
    body: JSON.stringify({}),
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${createResponse.deviceToken}`,
      "x-device-name": deviceName,
    },
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();

  // Double delete should not fail
  res = await fetch(`http://localhost:8000/api/admin/device`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "authorization": adminAuthHeader,
      "x-device-name": deviceName,
    },
  });
  assertEquals(res.status, 200);
  await res.body?.cancel();
});

Deno.test("renew", async () => {
  const deviceName = crypto.randomUUID();

  // Admin create
  const res = await fetch(`http://localhost:8000/api/admin/device`, {
    method: "POST",
    body: JSON.stringify({
      deviceName,
      publicKey: TEST_PUB,
      groups: ["server", "lighthouse"],
      ip: "192.168.100.1/24",
      amLighthouse: true,
      staticAddrs: ["8.8.8.8:4242"],
    }),
    headers: {
      "content-type": "application/json",
      "authorization": adminAuthHeader,
    },
  });
  assertEquals(res.status, 200);
  const createResponse = await res.json();
  createResponse.groups.sort();

  assert(createResponse.crt.startsWith("-----BEGIN NEBULA CERTIFICATE-----\n"));

  // Force expire
  await ddbClient.updateItem({
    TableName: Deno.env.get("DEVICE_TABLE_NAME")!,
    Key: {
      deviceName: { S: deviceName },
    },
    UpdateExpression: "SET renewableAt = :renewableAt",
    ExpressionAttributeValues: {
      ":renewableAt": { N: "0" },
    },
  });

  {
    const lambdaRes = await certsvcLambdaClient.invoke({
      FunctionName: Deno.env.get("CERTSVC_FUNCTION_NAME")!,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({
        action: "periodic_renew",
      }),
    });
    assertEquals(lambdaRes.StatusCode, 200);
    const lambdaResBody = JSON.parse(
      new TextDecoder().decode(lambdaRes.Payload!),
    );
    assertEquals(lambdaResBody, { count: 1 });
  }

  {
    const lambdaRes = await certsvcLambdaClient.invoke({
      FunctionName: Deno.env.get("CERTSVC_FUNCTION_NAME")!,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({
        action: "periodic_renew",
      }),
    });
    assertEquals(lambdaRes.StatusCode, 200);
    const lambdaResBody = JSON.parse(
      new TextDecoder().decode(lambdaRes.Payload!),
    );
    assertEquals(lambdaResBody, { count: 0 });
  }
});

Deno.test("fetch ca.crt", async () => {
  const res = await fetch(`http://localhost:8000/ca.crt`);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/x-pem-file");
  const caCrt = await res.text();
  assert(caCrt.startsWith("-----BEGIN NEBULA CERTIFICATE-----\n"));
});
