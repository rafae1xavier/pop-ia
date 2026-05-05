output "api_url" {
  value = aws_apigatewayv2_stage.default.invoke_url
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.bucket
}

output "procedures_table" {
  value = aws_dynamodb_table.procedures.name
}
