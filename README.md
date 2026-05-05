# Gerador de POP com IA na AWS

MVP para gerar Procedimentos Operacionais Padrao a partir de um nome de processo, usando Amazon Bedrock, Lambda, API Gateway, S3, DynamoDB e CloudFront.

O modelo foi baseado no PDF `POP XXX YYY 05-R09.pdf`, com esta estrutura:

- Cabecalho do Sistema de Gestao da Qualidade
- Objetivo
- Diagrama do processo
- Indicacao do diagrama em etapas numeradas
- Documentos relacionados
- Registros obrigatorios

## Arquitetura

Fluxo principal:

1. Frontend estatico no S3 + CloudFront recebe o nome do processo.
2. API Gateway chama uma Lambda Node.js.
3. Lambda monta o prompt e chama o Amazon Bedrock.
4. Lambda normaliza a resposta no schema oficial.
5. Lambda gera `processo.json`, `processo.mmd`, `processo.bpmn` e `relatorio.pdf`.
6. Artefatos sao salvos no S3 e metadados sao salvos no DynamoDB.

## Rodar local

Instale dependencias da API:

```bash
npm install --prefix apps/api
```

Suba a API local em modo demo:

```bash
DEMO_MODE=true npm run api:local
```

Em outro terminal, suba o frontend:

```bash
npm run web:local
```

Acesse:

```text
http://localhost:5173
```

## Deploy AWS

1. Empacote a Lambda:

```bash
npm run package:api
```

2. Crie um arquivo `infra/terraform.tfvars`:

```hcl
aws_region       = "us-east-1"
project_name     = "pop-ia"
bedrock_model_id = "seu-model-id-do-bedrock"
```

3. Aplique Terraform:

```bash
cd infra
terraform init
terraform apply
```

O output `cloudfront_url` abre o frontend publicado.

## Divisao de equipe

- Aluno 1: frontend em `apps/web`
- Aluno 2: backend IA em `apps/api/src/bedrock.js`, `apps/api/src/prompt.js` e `apps/api/src/schema.js`
- Aluno 3: documento e diagrama em `apps/api/src/renderers`
- Integracao/Terraform: `infra`

## Entrega para 06/05/2026

- Demonstrar geracao local com `DEMO_MODE=true`
- Mostrar schema JSON e prompt
- Mostrar Mermaid, BPMN XML e PDF
- Explicar arquitetura AWS
- Deixar claro que o `bedrock_model_id` e configuravel por regiao/modelo habilitado na conta
