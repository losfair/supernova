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
