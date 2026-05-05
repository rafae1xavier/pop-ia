export const POP_TEMPLATE = `
SISTEMA DE GESTAO DA QUALIDADE
PROCEDIMENTO OPERACIONAL PADRAO

TITULO: {{processName}}

Codigo: {{code}}
Revisao: {{revision}}
Data: {{date}}
Pagina: {{page}}

1. OBJETIVO
{{objective}}

2. DIAGRAMA
{{diagram}}

3. INDICACAO DO DIAGRAMA
{{detailedDescription}}

4. DOCUMENTOS QUE COMPOEM O PROCEDIMENTO
{{relatedDocuments}}

5. REGISTROS OBRIGATORIOS
{{recordsTable}}
`.trim();

export const PROCEDURE_SCHEMA_EXAMPLE = {
  header: {
    system: "Sistema de Gestao da Qualidade",
    processType: "Procedimento Operacional Padrao",
    processName: "",
    code: "",
    revision: "",
    date: ""
  },
  objective: "",
  diagram: {
    lanes: ["Qualidade", "Auditor", "Gestor"],
    steps: [],
    decisions: [],
    connections: []
  },
  detailedFlow: [
    {
      step: "3.1",
      description: "",
      notes: []
    }
  ],
  documents: ["ISO 9001", "Requisitos legais aplicaveis"],
  records: [
    {
      name: "",
      storage: "",
      retrieval: "",
      owner: "",
      access: "",
      retention: "",
      disposal: ""
    }
  ]
};

export function buildPrompt(input) {
  const processName = input.processName || "nao identificado";
  const code = input.code || "POP XXX YYY 00";
  const revision = input.revision || "00";
  const date = input.date || "nao identificado";
  const conversationContext = formatConversation(input.messages);
  const attachmentContext = formatAttachments(input.attachments);

  return `
Voce e um especialista em Sistema de Gestao da Qualidade, ISO 9001 e BPMN.

Gere um PROCEDIMENTO OPERACIONAL PADRAO completo para o processo: ${processName}.

Siga exatamente este template:
${POP_TEMPLATE}

Metadados solicitados:
- Codigo: ${code}
- Revisao: ${revision}
- Data: ${date}

Contexto da conversa com o usuario:
${conversationContext}

Arquivos anexados e conteudo extraido:
${attachmentContext}

Regras obrigatorias:
- Gere um objetivo claro, corporativo e auditavel.
- Gere etapas numeradas na secao 3 usando 3.1, 3.2, 3.3 e assim por diante.
- Inclua pelo menos uma decisao no fluxo.
- Inclua tratamento de nao conformidade ou acao corretiva quando fizer sentido.
- Inclua acompanhamento, verificacao de eficacia e fechamento.
- Preencha documentos relacionados, incluindo ISO 9001 quando aplicavel.
- Preencha a tabela de registros obrigatorios.
- Gere fluxo compativel com BPMN.
- Use a conversa e os anexos como fonte primaria.
- Nao invente nomes de sistemas, leis, clientes ou documentos especificos sem base. Quando nao souber, use "nao identificado".

Responda somente com JSON valido, sem markdown, seguindo este schema:
${JSON.stringify(PROCEDURE_SCHEMA_EXAMPLE, null, 2)}
`.trim();
}

function formatConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "- nao identificado";
  }

  return messages
    .slice(-20)
    .map((message) => {
      const role = message?.role === "assistant" ? "Agente" : "Usuario";
      const content = String(message?.content || "").replace(/\s+/g, " ").trim();
      return `- ${role}: ${content || "nao identificado"}`;
    })
    .join("\n");
}

function formatAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return "- nao identificado";
  }

  return attachments
    .slice(0, 10)
    .map((attachment) => {
      const name = String(attachment?.name || "arquivo sem nome").trim();
      const type = String(attachment?.type || "tipo nao identificado").trim();
      const extraction = String(attachment?.extraction || "metadata-only").trim();
      const text = String(attachment?.text || "").slice(0, 12000).trim();
      if (!text) {
        return `- ${name} (${type}, ${extraction}): conteudo textual nao extraido no modo atual.`;
      }
      return `- ${name} (${type}, ${extraction}):\n${text}`;
    })
    .join("\n\n");
}
