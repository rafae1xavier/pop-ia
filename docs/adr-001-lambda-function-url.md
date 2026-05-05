# ADR-001 — Lambda Function URL em vez de API Gateway HTTP API

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 2026-05-04 |
| **Contexto** | Integração com Amazon Bedrock para geração de POP |

---

## Contexto

O sistema gera um POP completo (JSON, Mermaid, BPMN, HTML e PDF) a partir de uma chamada ao Amazon Bedrock (Claude). O processo envolve:

1. Invocação do modelo de linguagem (~20–60 s dependendo do tamanho do processo)
2. Normalização e validação do JSON retornado
3. Renderização de 4 formatos de saída, incluindo PDF com PDFKit

A arquitetura inicial usava **API Gateway HTTP API** como ponto de entrada da Lambda.

---

## Problema

O **API Gateway HTTP API possui timeout fixo e irreduzível de 30 segundos** de integração com backends.

Durante testes em produção na AWS, a chamada ao Bedrock levou mais de 30 segundos, resultando em `503 Service Unavailable` devolvido pelo API Gateway antes de a Lambda concluir — mesmo com a Lambda configurada para 60 segundos.

```
POST https://5fbifkti4f.execute-api.us-east-1.amazonaws.com/ → 503
{"message": "Service Unavailable"}
```

O API Gateway REST API (v1) tem o mesmo limite de 29 segundos. Nenhuma configuração do API Gateway resolve esse problema para chamadas síncronas longas.

---

## Decisão

Substituir o **API Gateway HTTP API** por **Lambda Function URL**.

A Lambda Function URL é um endpoint HTTPS nativo da própria Lambda que:
- Não impõe timeout de integração (suporta até 15 minutos)
- Suporta CORS nativo configurável via Terraform
- Recebe eventos no mesmo formato payload v2.0 do API Gateway — sem alteração no código da Lambda
- É gratuita (sem custo adicional além da execução da Lambda)

### Mudanças aplicadas

**Terraform (`infra/main.tf`):**
- Removido: `aws_apigatewayv2_api`, `aws_apigatewayv2_integration`, `aws_apigatewayv2_route`, `aws_apigatewayv2_stage`, `aws_lambda_permission`
- Adicionado: `aws_lambda_function_url` com CORS configurado
- Timeout da Lambda: `60 s → 120 s`
- `config.js` no S3 agora aponta para a Function URL

**Código (`apps/api/src/`):** nenhuma alteração necessária — o formato do evento é compatível.

---

## Trade-offs

### Vantagens

| | |
|---|---|
| Sem limite de 30 s | Geração de POP pode levar até 2 minutos sem erro |
| Custo zero adicional | Function URL não tem custo próprio |
| Menos recursos AWS | Sem API Gateway para gerenciar/destruir |
| Deploy mais rápido | Sem propagação de stage do API Gateway |
| Compatibilidade de evento | Mesmo payload v2.0 — zero mudança no handler |

### Desvantagens

| | |
|---|---|
| Sem throttling nativo | API Gateway oferecia rate limiting por rota; Function URL não tem |
| Sem WAF integrado | API Gateway pode ser protegido com AWS WAF; Function URL não pode diretamente |
| URL não personalizada | URL gerada automaticamente (ex: `https://abc123.lambda-url.us-east-1.on.aws/`) |
| Sem logging estruturado por rota | API Gateway tem access logs por endpoint; Function URL depende de CloudWatch |
| Sem autenticação IAM granular por rota | Toda a função fica exposta como `NONE` (público) ou exige Cognito na aplicação |

Para o contexto atual (MVP acadêmico de demonstração), os trade-offs negativos são aceitáveis: não há necessidade de WAF, rate limiting ou domínio customizado nessa fase.

---

## Alternativas Consideradas

### API Gateway REST API (v1)
- **Motivo de descarte:** Mesmo limite de 29 segundos de integração com Lambda. Não resolve o problema.

### Padrão assíncrono (Lambda → SQS → Lambda → polling)
- **Motivo de descarte:** Aumenta a complexidade do sistema (fila, segunda Lambda, polling no frontend) para um MVP de demonstração. O ganho não justifica o esforço.

### WebSockets via API Gateway
- **Motivo de descarte:** Requer refatoração significativa do frontend e da Lambda para suportar conexões persistentes. Fora do escopo do MVP.

### Aumento do timeout do API Gateway
- **Motivo de descarte:** Não é possível. O limite de 30 s (HTTP API) e 29 s (REST API) é fixo e não configurável.

---

## Consequências

- O endpoint da API muda a cada redeploy (URL gerada pelo AWS com sufixo aleatório), mas o `config.js` é atualizado automaticamente pelo Terraform, então o frontend sempre aponta para a URL correta.
- Para futuras necessidades de WAF ou domínio customizado, pode-se colocar um CloudFront na frente da Function URL.
