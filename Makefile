.PHONY: bootstrap deploy destroy update local check

## Cria o bucket S3 para estado do Terraform (execute uma unica vez)
bootstrap:
	./scripts/bootstrap.sh

## Sobe toda a infraestrutura na AWS (build + terraform apply)
deploy:
	./scripts/deploy.sh

## Remove toda a infraestrutura da AWS (terraform destroy)
destroy:
	./scripts/destroy.sh

## Atualiza apenas o codigo da Lambda e os arquivos do frontend sem recriar a infra
update:
	npm run package:api
	cd infra && terraform apply -input=false -auto-approve \
		-target=aws_lambda_function.api \
		-target=aws_s3_object.web_assets \
		-target=aws_s3_object.web_config

## Roda API e frontend localmente (modo demo, sem AWS)
local:
	@echo "API em http://localhost:3000 | Frontend em http://localhost:5173"
	@npm run api:local & npm run web:local

## Verifica sintaxe dos arquivos JS
check:
	npm run check
