#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="$ROOT_DIR/infra"
BACKEND_HCL="$INFRA_DIR/backend.hcl"

if [[ ! -d "$INFRA_DIR/.terraform" ]]; then
  echo "Nenhuma infraestrutura inicializada. Rode 'make deploy' primeiro."
  exit 0
fi

echo ""
echo "==> Destruindo toda a infraestrutura AWS..."
echo "    (CloudFront pode levar 15-20 min para remover)"
echo ""

cd "$INFRA_DIR"

if [[ -f "$BACKEND_HCL" ]]; then
  terraform init -input=false -backend-config="$BACKEND_HCL" 2>/dev/null | tail -1
fi

terraform destroy -input=false -auto-approve "$@"

echo ""
echo "======================================================="
echo " Todos os recursos AWS foram removidos."
echo " Nenhum custo adicional sera gerado."
echo "======================================================="
