variable "aws_region" {
  description = "Regiao AWS onde API, Lambda, S3 e DynamoDB serao criados."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefixo dos recursos AWS."
  type        = string
  default     = "pop-ia"
}

variable "lambda_zip_path" {
  description = "Caminho do pacote zip gerado por npm run package:api."
  type        = string
  default     = "../dist/lambda.zip"
}

variable "bedrock_model_id" {
  description = "Model ID habilitado no Amazon Bedrock. Se ficar vazio, a Lambda roda em modo demo."
  type        = string
  default     = ""
}

variable "allowed_origins" {
  description = "Origins liberadas no CORS da API."
  type        = list(string)
  default     = ["*"]
}
