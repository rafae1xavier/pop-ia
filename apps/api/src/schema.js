const DEFAULT_LANES = ["Qualidade", "Auditor", "Gestor"];

export function normalizeProcedure(raw, request) {
  const fallback = createFallbackProcedure(request);
  const source = isObject(raw) ? raw : {};

  const procedure = {
    ...fallback,
    ...source,
    header: {
      ...fallback.header,
      ...(isObject(source.header) ? source.header : {}),
      processName: cleanText(source.header?.processName || request.processName || fallback.header.processName),
      code: cleanText(source.header?.code || request.code || fallback.header.code),
      revision: cleanText(source.header?.revision || request.revision || fallback.header.revision),
      date: cleanText(source.header?.date || request.date || fallback.header.date)
    },
    diagram: normalizeDiagram(source.diagram, fallback.diagram),
    detailedFlow: normalizeDetailedFlow(source.detailedFlow, fallback.detailedFlow),
    documents: normalizeStringArray(source.documents, fallback.documents),
    records: normalizeRecords(source.records, fallback.records)
  };

  procedure.objective = cleanText(source.objective || request.objective || fallback.objective);
  return procedure;
}

export function createFallbackProcedure(request = {}) {
  const processName = cleanText(request.processName || "nao identificado");
  const code = cleanText(request.code || "POP XXX YYY 00");
  const revision = cleanText(request.revision || "00");
  const date = cleanText(request.date || formatDate(new Date()));

  const steps = [
    {
      id: "S1",
      number: "3.1",
      lane: "Qualidade",
      title: "Planejar o processo",
      description: `A area responsavel elabora o planejamento do processo ${processName}, definindo escopo, responsaveis, criterios, periodicidade e registros aplicaveis.`
    },
    {
      id: "S2",
      number: "3.2",
      lane: "Gestor",
      title: "Programar execucao",
      description: "O gestor programa a execucao das atividades, comunica os envolvidos e confirma disponibilidade de recursos e documentos."
    },
    {
      id: "S3",
      number: "3.3",
      lane: "Auditor",
      title: "Executar verificacao",
      description: "O responsavel executa a verificacao conforme criterios definidos, coletando evidencias e registrando conformidades, observacoes e oportunidades de melhoria."
    },
    {
      id: "S4",
      number: "3.4",
      lane: "Auditor",
      title: "Registrar resultado",
      description: "Os resultados sao registrados em relatorio ou formulario controlado, com identificacao das evidencias analisadas."
    },
    {
      id: "S5",
      number: "3.5",
      lane: "Qualidade",
      title: "Avaliar conformidade",
      description: "A Qualidade avalia se os resultados atendem aos requisitos do SGQ, ISO 9001, requisitos legais aplicaveis e requisitos do cliente, quando houver."
    },
    {
      id: "S6",
      number: "3.6",
      lane: "Gestor",
      title: "Tratar nao conformidade",
      description: "Quando houver nao conformidade, o gestor registra causa, define acao corretiva, prazo e responsavel, acompanhando a execucao ate a conclusao."
    },
    {
      id: "S7",
      number: "3.7",
      lane: "Qualidade",
      title: "Acompanhar eficacia",
      description: "A Qualidade acompanha as acoes definidas, verifica a eficacia e atualiza os registros do SGQ."
    },
    {
      id: "S8",
      number: "3.8",
      lane: "Qualidade",
      title: "Fechar e arquivar",
      description: "Apos conclusao e verificacao de eficacia, os registros sao arquivados conforme tempo de retencao definido."
    }
  ];

  return {
    header: {
      system: "Sistema de Gestao da Qualidade",
      processType: "Procedimento Operacional Padrao",
      processName,
      code,
      revision,
      date
    },
    objective: `Este procedimento tem por objetivo definir a rotina para execucao, controle, registro e melhoria continua do processo ${processName}, atendendo aos requisitos aplicaveis da ISO 9001 e do Sistema de Gestao da Qualidade.`,
    diagram: {
      lanes: DEFAULT_LANES,
      steps,
      decisions: [
        {
          id: "D1",
          lane: "Qualidade",
          question: "Foram identificadas nao conformidades?",
          yes: "S6",
          no: "S7"
        }
      ],
      connections: [
        { from: "START", to: "S1" },
        { from: "S1", to: "S2" },
        { from: "S2", to: "S3" },
        { from: "S3", to: "S4" },
        { from: "S4", to: "S5" },
        { from: "S5", to: "D1" },
        { from: "D1", to: "S6", label: "Sim" },
        { from: "D1", to: "S7", label: "Nao" },
        { from: "S6", to: "S7" },
        { from: "S7", to: "S8" },
        { from: "S8", to: "END" }
      ]
    },
    detailedFlow: steps.map((step) => ({
      step: step.number,
      description: step.description,
      notes: []
    })),
    documents: [
      "ISO 9001",
      "Requisitos legais aplicaveis",
      "Requisitos do cliente, quando aplicavel",
      "Procedimento de tratamento de nao conformidades"
    ],
    records: [
      {
        name: `Plano do processo ${processName}`,
        storage: "Meio eletronico ou fisico controlado",
        retrieval: "Por data, codigo ou nome do processo",
        owner: "Qualidade",
        access: "Qualidade, gestor do processo e auditor autorizado",
        retention: "Enquanto vigente ou conforme requisito aplicavel",
        disposal: "Eliminar conforme politica de retencao"
      },
      {
        name: `Relatorio do processo ${processName}`,
        storage: "Meio eletronico ou fisico controlado",
        retrieval: "Por data ou responsavel",
        owner: "Gestor do processo",
        access: "Qualidade, gestor do processo e diretoria",
        retention: "Por 5 anos, salvo requisito especifico",
        disposal: "Eliminar conforme politica de retencao"
      }
    ]
  };
}

export function parseModelJson(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : extractFirstJsonObject(text);

  if (!candidate) {
    return null;
  }

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeDiagram(diagram, fallback) {
  if (!isObject(diagram)) {
    return fallback;
  }

  return {
    lanes: normalizeStringArray(diagram.lanes, fallback.lanes),
    steps: Array.isArray(diagram.steps) && diagram.steps.length > 0 ? diagram.steps.map(normalizeStep) : fallback.steps,
    decisions: Array.isArray(diagram.decisions) ? diagram.decisions.map(normalizeDecision) : fallback.decisions,
    connections: Array.isArray(diagram.connections) && diagram.connections.length > 0 ? diagram.connections.map(normalizeConnection) : fallback.connections
  };
}

function normalizeStep(step, index) {
  const safe = isObject(step) ? step : {};
  return {
    id: cleanId(safe.id || `S${index + 1}`),
    number: cleanText(safe.number || safe.step || `3.${index + 1}`),
    lane: cleanText(safe.lane || "Qualidade"),
    title: cleanText(safe.title || safe.name || `Etapa ${index + 1}`),
    description: cleanText(safe.description || "nao identificado")
  };
}

function normalizeDecision(decision, index) {
  const safe = isObject(decision) ? decision : {};
  return {
    id: cleanId(safe.id || `D${index + 1}`),
    lane: cleanText(safe.lane || "Qualidade"),
    question: cleanText(safe.question || "Condicao atendida?"),
    yes: cleanId(safe.yes || safe.yesTarget || ""),
    no: cleanId(safe.no || safe.noTarget || "")
  };
}

function normalizeConnection(connection) {
  const safe = isObject(connection) ? connection : {};
  return {
    from: cleanId(safe.from || safe.source || ""),
    to: cleanId(safe.to || safe.target || ""),
    label: cleanText(safe.label || "")
  };
}

function normalizeDetailedFlow(flow, fallback) {
  if (!Array.isArray(flow) || flow.length === 0) {
    return fallback;
  }

  return flow.map((item, index) => ({
    step: cleanText(item?.step || `3.${index + 1}`),
    description: cleanText(item?.description || "nao identificado"),
    notes: normalizeStringArray(item?.notes, [])
  }));
}

function normalizeRecords(records, fallback) {
  if (!Array.isArray(records) || records.length === 0) {
    return fallback;
  }

  return records.map((record) => ({
    name: cleanText(record?.name || "nao identificado"),
    storage: cleanText(record?.storage || "nao identificado"),
    retrieval: cleanText(record?.retrieval || "nao identificado"),
    owner: cleanText(record?.owner || "nao identificado"),
    access: cleanText(record?.access || "nao identificado"),
    retention: cleanText(record?.retention || "nao identificado"),
    disposal: cleanText(record?.disposal || "nao identificado")
  }));
}

function normalizeStringArray(value, fallback) {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }

  return value.map((item) => cleanText(item)).filter(Boolean);
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function cleanId(value) {
  const text = cleanText(value);
  return text.replace(/[^A-Za-z0-9_-]/g, "_");
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza"
  }).format(date);
}

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}
