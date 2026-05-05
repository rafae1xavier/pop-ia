#!/usr/bin/env bash
# Cria o bucket S3 para armazenar o estado do Terraform.
# Execute uma única vez antes do primeiro deploy.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

if ! ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null); then
  echo "ERRO: Credenciais AWS nao configuradas."
  echo "      Configure via 'aws configure' ou exporte AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY."
  exit 1
fi

BUCKET="pop-ia-tfstate-${ACCOUNT_ID}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_FILE="$ROOT_DIR/infra/backend.hcl"

echo ""
echo "==> Conta AWS : $ACCOUNT_ID"
echo "==> Regiao    : $REGION"
echo "==> Bucket    : $BUCKET"
echo ""

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket ja existe, pulando criacao."
else
  echo "Criando bucket de estado..."

  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" > /dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" > /dev/null
  fi

  aws s3api put-bucket-versioning --bucket "$BUCKET" \
    --versioning-configuration Status=Enabled

  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  echo "Bucket criado com versionamento habilitado."
fi

cat > "$BACKEND_FILE" <<EOF
bucket = "$BUCKET"
key    = "pop-ia/terraform.tfstate"
region = "$REGION"
EOF

echo ""
echo "==> backend.hcl gerado em infra/backend.hcl"
echo ""
echo "======================================================="
echo " Proximo passo — inicialize o Terraform com o backend:"
echo ""
echo "   cd infra"
echo "   terraform init -backend-config=backend.hcl"
echo ""
echo " GitHub Actions — adicione estes Secrets no repositorio:"
echo "   AWS_ACCESS_KEY_ID      = <sua chave>"
echo "   AWS_SECRET_ACCESS_KEY  = <sua chave secreta>"
echo "   AWS_REGION             = $REGION"
echo "   TF_STATE_BUCKET        = $BUCKET"
echo "   BEDROCK_MODEL_ID       = us.anthropic.claude-3-5-haiku-20241022-v1:0"
echo "======================================================="
