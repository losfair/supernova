resource "aws_lambda_function" "certsvc" {
  function_name = "${var.resource_prefix}-certsvc"
  role          = aws_iam_role.certsvc.arn
  image_uri     = "547201571710.dkr.ecr.us-west-2.amazonaws.com/supernova:certsvc-0.0.0-alpha.17"
  package_type  = "Image"

  environment {
    variables = {
      NEBULA_CA_CRT_B64      = var.nebula_ca_crt_b64
      NEBULA_CA_KEY_B64      = var.nebula_ca_key_b64
      DYNAMODB_DEVICES_TABLE = "${var.resource_prefix}-devices"
    }
  }
}

resource "aws_dynamodb_table" "devices" {
  name         = "${var.resource_prefix}-devices"
  hash_key     = "deviceName"
  billing_mode = "PAY_PER_REQUEST"
  table_class  = "STANDARD"

  point_in_time_recovery {
    enabled = true
  }

  attribute {
    name = "deviceName"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cloudwatch_event_rule" "certsvc-renew" {
  name        = "${var.resource_prefix}-certsvc-renew"
  description = "Renew certificates"

  schedule_expression = "rate(60 minutes)"
}

resource "aws_cloudwatch_event_target" "certsvc-renew" {
  rule = aws_cloudwatch_event_rule.certsvc-renew.name
  arn  = aws_lambda_function.certsvc.arn

  input_transformer {
    input_template = <<EOF
{
  "action": "periodic_renew"
}
EOF
  }
}

resource "aws_lambda_permission" "certsvc-renew-cloudwatch" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.certsvc.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.certsvc-renew.arn
}

resource "aws_cloudwatch_log_group" "certsvc-log-group" {
  name              = "/aws/lambda/${aws_lambda_function.certsvc.function_name}"
  retention_in_days = 7
}
