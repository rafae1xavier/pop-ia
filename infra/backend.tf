terraform {
  backend "s3" {
    # Valores configurados em runtime via:
    #   terraform init -backend-config=backend.hcl        (local)
    #   terraform init -backend-config="bucket=..." ...   (CI)
    #
    # Execute scripts/bootstrap.sh uma vez para criar o bucket e gerar backend.hcl
  }
}
