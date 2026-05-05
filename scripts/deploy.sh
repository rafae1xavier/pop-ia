#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="$ROOT_DIR/infra"
BACKEND_HCL="$INFRA_DIR/backend.hcl"

# --- credenciais AWS -----------------------------------------------------------
if ! aws sts get-caller-identity --query "Account" --output text &>/dev/null; then
  echo "ERRO: Credenciais AWS nao configuradas."
  echo "      Configure via 'aws configure' ou exporte AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY."
  exit 1
fi

# --- backend remoto -----------------------------------------------------------
if [[ ! -f "$BACKEND_HCL" ]]; then
  echo "AVISO: infra/backend.hcl nao encontrado."
  echo "       Execute './scripts/bootstrap.sh' uma vez para criar o bucket de estado."
  echo "       Sem isso o estado sera local e o destroy pelo CI nao funcionara."
  echo ""
fi

# --- terraform.tfvars ---------------------------------------------------------
if [[ ! -f "$INFRA_DIR/terraform.tfvars" ]]; then
  echo "AVISO: infra/terraform.tfvars nao encontrado."
  echo "       Copie infra/terraform.tfvars.example, preencha e tente novamente."
  echo ""
fi

# --- empacotar Lambda ---------------------------------------------------------
echo "==> [1/3] Empacotando API Lambda..."
npm run package:api --prefix "$ROOT_DIR"

# --- terraform apply ----------------------------------------------------------
echo ""
echo "==> [2/3] Inicializando Terraform..."
cd "$INFRA_DIR"

if [[ -f "$BACKEND_HCL" ]]; then
  terraform init -upgrade -input=false -backend-config="$BACKEND_HCL"
else
  terraform init -upgrade -input=false
fi

echo ""
echo "==> [3/3] Aplicando infraestrutura (pode levar 10-15 min por causa do CloudFront)..."
terraform apply -input=false -auto-approve "$@"

# --- saida --------------------------------------------------------------------
echo ""
echo "======================================================="
echo " Deploy concluido!"
echo ""
echo " Frontend (CloudFront — pode levar alguns minutos para propagar):"
echo "   $(terraform output -raw cloudfront_url)"
echo ""
echo " API Gateway (disponivel imediatamente para testes):"
echo "   $(terraform output -raw api_url)"
echo ""
echo " Para destruir tudo: make destroy"
echo "======================================================="
