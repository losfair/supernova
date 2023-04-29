output "dash_access_key" {
  value = aws_iam_access_key.dash.id
}

output "dash_secret_key" {
  value     = aws_iam_access_key.dash.secret
  sensitive = true
}

output "certsvc_lambda_arn" {
  value = aws_lambda_function.certsvc.arn
}
