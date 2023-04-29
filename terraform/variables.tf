variable "resource_prefix" {
  type        = string
  description = "Prefix for all resources"
}

variable "nebula_ca_key_b64" {
  type        = string
  description = "Base64 encoded Nebula CA key"
  sensitive   = true
}

variable "nebula_ca_crt_b64" {
  type        = string
  description = "Base64 encoded Nebula CA cert"
}
