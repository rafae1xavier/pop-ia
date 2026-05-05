# Divisao de Trabalho

## Aluno 1 - Frontend

Responsavel por `apps/web`.

Entregas:

- Tela com campo do processo, codigo, revisao e data.
- Chamada para API.
- Visualizacao do documento.
- Visualizacao do Mermaid.
- Download de PDF, JSON e BPMN.

## Aluno 2 - Backend IA

Responsavel por:

- `apps/api/src/prompt.js`
- `apps/api/src/bedrock.js`
- `apps/api/src/schema.js`

Entregas:

- Prompt final.
- Chamada ao Bedrock.
- Parser da resposta JSON.
- Normalizacao contra campos vazios.

## Aluno 3 - Documento e Diagrama

Responsavel por `apps/api/src/renderers`.

Entregas:

- JSON para Mermaid.
- JSON para BPMN XML.
- JSON para PDF no layout SGQ.
- Ajustes de tabela e cabecalho.

## Integracao

Responsavel por `infra` e revisao final.

Entregas:

- Terraform.
- Empacotamento da Lambda.
- Deploy S3/CloudFront/API Gateway/Lambda.
- Permissoes IAM.
- Roteiro de demonstracao.

## Roteiro curto para apresentacao

1. Mostrar o PDF modelo e a estrutura extraida.
2. Mostrar o schema JSON.
3. Gerar um POP pelo frontend.
4. Abrir a aba de diagrama.
5. Baixar PDF, JSON e BPMN.
6. Explicar arquitetura AWS.
7. Explicar como cada aluno contribuiu.
