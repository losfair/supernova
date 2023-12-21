import { DynamoDB } from "aws_api/services/dynamodb/mod.ts";
import { Lambda } from "aws_api/services/lambda/mod.ts";
import { DeviceInfo, DeviceInput } from "./types.ts";
import {
  PutItemInput,
  UpdateItemInput,
} from "aws_api/services/dynamodb/structs.ts";
import { encode as hexEncode } from "std/encoding/hex.ts";
import { AwsServiceError } from "aws_api/client/common.ts";

interface CertificateRequest {
  action: "sign";
  public_key: string;
  name: string;
  groups: string[];
  ip: string;
  duration_secs?: number;
}

interface CertificateResponse {
  crt: string;
  renewable_at: number;
}

export class DeviceModel {
  constructor(
    public readonly ddb: DynamoDB,
    public readonly lambda: Lambda,
    public readonly options: { tableName: string; certsvcFunctionName: string },
  ) {
  }

  private async signDeviceCertificate(
    info: DeviceInfo,
    opts?: { durationSecs?: number },
  ): Promise<CertificateResponse> {
    const input: CertificateRequest = {
      action: "sign",
      public_key: info.publicKey,
      name: info.deviceName,
      groups: info.groups,
      ip: info.ip,
      duration_secs: opts?.durationSecs,
    };
    const resp = await this.lambda.invoke({
      FunctionName: this.options.certsvcFunctionName,
      Payload: JSON.stringify(input),
    });
    if (resp.StatusCode !== 200) {
      throw new Error(
        `Failed to sign certificate: ${resp.StatusCode} ${resp.FunctionError}`,
      );
    }

    if (resp.FunctionError) {
      throw new Error(`Failed to sign certificate: ${resp.FunctionError}`);
    }

    const output: CertificateResponse = JSON.parse(
      new TextDecoder().decode(resp.Payload!),
    );
    return output;
  }

  async addDevice(input: DeviceInput): Promise<DeviceInfo> {
    const info: DeviceInfo = {
      deviceName: input.deviceName,
      deviceToken: new TextDecoder().decode(
        hexEncode(crypto.getRandomValues(new Uint8Array(16))),
      ),
      publicKey: input.publicKey,
      groups: input.groups,
      ip: input.ip,
      amLighthouse: input.amLighthouse,
      crt: "TODO",
      renewableAt: 0,
      staticAddrs: input.staticAddrs,
    };
    const { crt, renewable_at } = await this.signDeviceCertificate(info, {
      durationSecs: input.certDurationSecs,
    });
    info.crt = crt;
    info.renewableAt = renewable_at;

    const putInput: PutItemInput = {
      TableName: this.options.tableName,
      ConditionExpression: "attribute_not_exists(deviceName)",
      Item: {
        deviceName: { S: info.deviceName },
        deviceToken: { S: info.deviceToken },
        publicKey: { S: info.publicKey },
        groups: info.groups.length ? { SS: info.groups } : { NULL: true },
        ip: { S: info.ip },
        amLighthouse: { BOOL: info.amLighthouse },
        staticAddrs: info.staticAddrs.length
          ? { SS: info.staticAddrs }
          : { NULL: true },
        crt: { S: info.crt },
        renewableAt: { N: info.renewableAt.toString() },
      },
    };

    try {
      await this.ddb.putItem(putInput);
      return info;
    } catch (e) {
      if (
        e instanceof AwsServiceError &&
        e.shortCode === "ConditionalCheckFailedException"
      ) {
        // proceed to update
      } else {
        throw e;
      }
    }

    const updateInput: UpdateItemInput = {
      TableName: this.options.tableName,
      Key: {
        deviceName: { S: info.deviceName },
      },
      ReturnValues: "ALL_NEW",
      UpdateExpression:
        `SET publicKey = :publicKey, groups = :groups, ip = :ip, amLighthouse = :amLighthouse, staticAddrs = :staticAddrs, crt = :crt, renewableAt = :renewableAt`,
      ExpressionAttributeValues: {
        ":publicKey": { S: info.publicKey },
        ":groups": info.groups.length ? { SS: info.groups } : { NULL: true },
        ":ip": { S: info.ip },
        ":amLighthouse": { BOOL: info.amLighthouse },
        ":staticAddrs": info.staticAddrs.length
          ? { SS: info.staticAddrs }
          : { NULL: true },
        ":crt": { S: info.crt },
        ":renewableAt": { N: info.renewableAt.toString() },
      },
    };

    const { Attributes: attributes } = await this.ddb.updateItem(
      updateInput,
    );

    if (!attributes) throw new Error("Failed to update device");

    info.deviceToken = attributes.deviceToken!.S!;
    return info;
  }

  async getDevice(deviceName: string): Promise<DeviceInfo | null> {
    const { Item: item } = await this.ddb.getItem({
      TableName: this.options.tableName,
      Key: {
        deviceName: { S: deviceName },
      },
    });
    if (!item) return null;

    return {
      deviceName: item.deviceName!.S!,
      deviceToken: item.deviceToken!.S!,
      publicKey: item.publicKey!.S!,
      groups: item.groups!.SS ?? [],
      ip: item.ip!.S!,
      amLighthouse: item.amLighthouse!.BOOL!,
      crt: item.crt!.S!,
      renewableAt: parseInt(item.renewableAt!.N!),
      staticAddrs: item.staticAddrs!.SS ?? [],
    };
  }

  async listDevices(): Promise<DeviceInfo[]> {
    const { Items: items } = await this.ddb.scan({
      TableName: this.options.tableName,
    });
    if (!items) return [];

    return items.map((item) => ({
      deviceName: item.deviceName!.S!,
      deviceToken: item.deviceToken!.S!,
      publicKey: item.publicKey!.S!,
      groups: item.groups!.SS ?? [],
      ip: item.ip!.S!,
      amLighthouse: item.amLighthouse!.BOOL!,
      crt: item.crt!.S!,
      renewableAt: parseInt(item.renewableAt!.N!),
      staticAddrs: item.staticAddrs!.SS ?? [],
    }));
  }

  async deleteDevice(deviceName: string): Promise<void> {
    await this.ddb.deleteItem({
      TableName: this.options.tableName,
      Key: {
        deviceName: { S: deviceName },
      },
    });
  }
}
