# Arquitetura AWS

## Objetivo

Criar um gerador automatico de Procedimentos Operacionais Padrao alinhado ao SGQ/ISO 9001, produzindo JSON estruturado, diagrama Mermaid, BPMN XML e PDF final.

## Componentes

| Camada | Servico | Responsabilidade |
| --- | --- | --- |
| Frontend | S3 + CloudFront | Hospedar a interface web estatica |
| API | API Gateway HTTP API | Expor endpoint HTTPS para geracao |
| Backend | AWS Lambda Node.js | Montar prompt, chamar IA e gerar artefatos |
| IA | Amazon Bedrock | Gerar o conteudo estruturado do POP |
| Documentos | S3 privado | Armazenar JSON, Mermaid, BPMN, HTML e PDF |
| Metadados | DynamoDB | Guardar historico basico de geracoes |
| Permissoes | IAM | Aplicar menor privilegio para Lambda |

## Fluxo

1. Usuario informa o processo no frontend.
2. Frontend envia `POST` para API Gateway.
3. Lambda valida entrada e monta o prompt oficial.
4. Bedrock retorna JSON no schema do POP.
5. Lambda normaliza o JSON para evitar campos ausentes.
6. Lambda gera:
   - `processo.json`
   - `processo.mmd`
   - `processo.bpmn`
   - `relatorio.html`
   - `relatorio.pdf`
7. Lambda salva artefatos no S3 e metadados no DynamoDB.
8. Frontend exibe documento, diagrama e downloads.

## Decisoes tecnicas

- O `bedrock_model_id` fica como variavel Terraform porque o modelo habilitado depende da regiao e da conta AWS.
- A Lambda tem `DEMO_MODE=true` quando nenhum modelo e configurado, permitindo apresentacao sem credenciais Bedrock.
- O PDF e gerado no backend para preservar padrao de documento e reduzir dependencia do navegador.
- O BPMN XML e propositalmente simples no MVP, mas ja pode ser aberto/evoluido em ferramentas BPMN.

## Proximos passos de producao

- Adicionar autenticacao com Cognito.
- Usar URLs pre-assinadas para download dos arquivos salvos no S3.
- Adicionar revisao humana antes de aprovar o POP.
- Criar versionamento por codigo/revisao do procedimento.
- Validar JSON com biblioteca de JSON Schema antes de gerar documentos.
- Melhorar BPMN com coordenadas BPMN DI para editores visuais.
