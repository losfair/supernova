# supernova

A control plane for the [Nebula](https://github.com/slackhq/nebula) overlay
networking system.

![screenshot](res/dash-screenshot.png)

## Pre-requisites

- Deno
- Terraform
- AWS account

## Setting up

1. In your Terraform configuration, pull in the `supernova/terraform` module:

```terraform
module "supernova" {
  source            = "../vendor/supernova/terraform"
  resource_prefix   = "supernova"
  nebula_ca_key_b64 = var.nebula_ca_key_b64
  nebula_ca_crt_b64 = var.nebula_ca_crt_b64
}
```

2. Fork this project and deploy the `dash/` directory to Deno Deploy.

Environment variables should be set as follows:

```
AWS_REGION = "<fill this>"
AWS_ACCESS_KEY_ID = "<fill this>"
AWS_SECRET_ACCESS_KEY = "<fill this>"

GITHUB_CLIENT_ID = "<fill this>"
GITHUB_CLIENT_SECRET = "<fill this>"

# AWS resources created by Terraform
DEVICE_TABLE_NAME = "supernova-devices"
CERTSVC_FUNCTION_NAME = "supernova-certsvc"

JWT_SECRET = "<fill this: random jwt secret>"

NEBULA_CA_CRT_B64 = "<fill this: my-ca-cert-base64-encoded>"
```

3. On each member node, run the `supernovad` service. You need to generate a
   Nebula keypair and register the public key on the dashboard first:

```bash
nebula-cert keygen -out-key ./host.key -out-pub ./host.pub
```

You can use any service manager you like, but here's an example systemd unit:

```systemd
[Unit]
Description=Supernova Daemon
After=network-online.target
Requires=network-online.target

[Service]
DynamicUser=true
ExecStart=/usr/local/bin/supernovad
Restart=on-failure
AmbientCapabilities=CAP_NET_ADMIN
EnvironmentFile=/opt/supernovad-prod/env

[Install]
WantedBy=multi-user.target
```

An example `/opt/supernovad-prod/env` looks like:

```
DEVICE_NAME=<your-device-name>
DEVICE_TOKEN=<your-device-token>
DASH_ENDPOINT=https://nova.su3.io
CONFIG_OVERRIDE_FILE=/opt/supernovad-prod/override.yml
NEBULA_EXECUTABLE=/usr/local/bin/nebula
```

And `/opt/supernovad-prod/override.yml`:

```yaml
pki:
  key: /opt/supernovad-prod/host.key
```
