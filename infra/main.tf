provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name       = "${var.project_name}-${random_id.suffix.hex}"
  lambda_zip = abspath("${path.module}/${var.lambda_zip_path}")

  content_types = {
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
  }
}

resource "aws_s3_bucket" "web" {
  bucket        = "${local.name}-web"
  force_destroy = true
}

resource "aws_s3_bucket" "documents" {
  bucket        = "${local.name}-documents"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "procedures" {
  name         = "${local.name}-procedures"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

resource "aws_iam_role" "lambda" {
  name = "${local.name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_app" {
  name = "${local.name}-lambda-app"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.documents.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem"
        ]
        Resource = aws_dynamodb_table.procedures.arn
      }
    ]
  })
}

resource "aws_lambda_function" "api" {
  function_name    = "${local.name}-api"
  role             = aws_iam_role.lambda.arn
  handler          = "src/index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = local.lambda_zip
  source_code_hash = filebase64sha256(local.lambda_zip)
  timeout          = 120
  memory_size      = 1024

  environment {
    variables = {
      BEDROCK_MODEL_ID  = var.bedrock_model_id
      DEMO_MODE         = var.bedrock_model_id == "" ? "true" : "false"
      DOCUMENT_BUCKET   = aws_s3_bucket.documents.bucket
      PROCEDURE_TABLE   = aws_dynamodb_table.procedures.name
      CORS_ALLOW_ORIGIN = join(",", var.allowed_origins)
    }
  }
}

resource "aws_lambda_permission" "function_url_public" {
  statement_id           = "AllowPublicFunctionURL"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Lambda Function URL substitui API Gateway — sem limite de 30s (ADR-001)
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = var.allowed_origins
    allow_methods     = ["GET", "POST"]
    allow_headers     = ["content-type"]
    max_age           = 3600
  }
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.name}-web-oac"
  description                       = "Acesso privado ao bucket web"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    target_origin_id       = "web"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "web_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_bucket.json
}

resource "aws_s3_object" "web_assets" {
  for_each = fileset("${path.module}/../apps/web", "*")

  bucket       = aws_s3_bucket.web.id
  key          = each.value
  source       = "${path.module}/../apps/web/${each.value}"
  etag         = filemd5("${path.module}/../apps/web/${each.value}")
  content_type = lookup(local.content_types, regex("\\.[^.]+$", each.value), "application/octet-stream")
}

resource "aws_s3_object" "web_config" {
  bucket       = aws_s3_bucket.web.id
  key          = "config.js"
  content      = "window.APP_CONFIG = { apiBaseUrl: \"${aws_lambda_function_url.api.function_url}\" };"
  etag         = md5("window.APP_CONFIG = { apiBaseUrl: \"${aws_lambda_function_url.api.function_url}\" };")
  content_type = "text/javascript; charset=utf-8"
}
