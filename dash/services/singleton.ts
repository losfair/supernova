import { ApiFactory } from "aws_api/client/mod.ts";
import { DynamoDB } from "aws_api/services/dynamodb/mod.ts";
import { DeviceModel } from "./model.ts";
import { Lambda } from "aws_api/services/lambda/mod.ts";

export const ddbClient = new ApiFactory({
  fixedEndpoint: Deno.env.get("DDB_ENDPOINT"),
}).makeNew(DynamoDB);
export const certsvcLambdaClient = new ApiFactory({
  fixedEndpoint: Deno.env.get("CERTSVC_LAMBDA_ENDPOINT"),
}).makeNew(Lambda);
export const deviceModel = new DeviceModel(ddbClient, certsvcLambdaClient, {
  tableName: mustGetEnv("DEVICE_TABLE_NAME"),
  certsvcFunctionName: mustGetEnv("CERTSVC_FUNCTION_NAME"),
});
export const jwtSecretKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(mustGetEnv("JWT_SECRET")),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

function mustGetEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`env var ${name} not found`);
  return value;
}
