resource "aws_iam_user" "dash" {
  name = "${var.resource_prefix}-dash"
}

resource "aws_iam_access_key" "dash" {
  user = aws_iam_user.dash.name
}

resource "aws_iam_user_policy" "dash-can-invoke-lambda" {
  name = "${var.resource_prefix}-dash-can-invoke-lambda"
  user = aws_iam_user.dash.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.certsvc.arn
        ]
      }
    ]
  })
}

resource "aws_iam_user_policy" "dash-can-access-dynamodb" {
  name = "${var.resource_prefix}-dash-can-access-dynamodb"
  user = aws_iam_user.dash.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        // https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/iam-policy-specific-table-indexes.html
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:GetItem",
          "dynamodb:BatchGetItem",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:ConditionCheckItem"
        ]
        Resource = [
          aws_dynamodb_table.devices.arn,
          "${aws_dynamodb_table.devices.arn}/index/*"
        ]
      }
    ]
  })
}

data "aws_iam_policy_document" "assume-role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "certsvc" {
  name               = "${var.resource_prefix}-certsvc"
  assume_role_policy = data.aws_iam_policy_document.assume-role.json


  inline_policy {
    name = "${var.resource_prefix}-certsvc-can-access-dynamodb"

    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          // https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/iam-policy-specific-table-indexes.html
          Action = [
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:BatchWriteItem",
            "dynamodb:GetItem",
            "dynamodb:BatchGetItem",
            "dynamodb:Scan",
            "dynamodb:Query",
            "dynamodb:ConditionCheckItem"
          ]
          Resource = [
            aws_dynamodb_table.devices.arn,
            "${aws_dynamodb_table.devices.arn}/index/*"
          ]
        }
      ]
    })
  }

  inline_policy {
    name = "${var.resource_prefix}-certsvc-can-write-logs"
    policy = jsonencode({
      "Version" = "2012-10-17",
      "Statement" = [
        {
          Action = [
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          Effect   = "Allow",
          Resource = "arn:aws:logs:*:*:*"
        }
      ]
    })
  }
}
