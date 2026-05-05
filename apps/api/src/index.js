import { buildPrompt } from "./prompt.js";
import { generateProcedureJson } from "./bedrock.js";
import { normalizeProcedure } from "./schema.js";
import { toMermaid } from "./renderers/mermaid.js";
import { toBpmnXml } from "./renderers/bpmn.js";
import { toHtml } from "./renderers/html.js";
import { toPdfBuffer } from "./renderers/pdf.js";
import { persistArtifacts } from "./storage.js";

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = event.rawPath || event.path || "/";

  if (method === "OPTIONS") {
    return response(204, "");
  }

  if (method === "GET" && path.endsWith("/health")) {
    return response(200, { ok: true });
  }

  if (method !== "POST") {
    return response(405, { message: "Metodo nao permitido" });
  }

  let payload;
  try {
    payload = parseBody(event);
  } catch {
    return response(400, { message: "JSON invalido" });
  }

  payload = normalizeRequest(payload);

  if (!hasGenerationContext(payload)) {
    return response(400, { message: "Informe o processo, uma mensagem ou um anexo" });
  }

  try {
    const prompt = buildPrompt(payload);
    const modelOutput = await generateProcedureJson(prompt);
    const procedure = normalizeProcedure(modelOutput, payload);
    const mermaid = toMermaid(procedure);
    const bpmnXml = toBpmnXml(procedure);
    const html = toHtml(procedure, mermaid);
    const pdfBuffer = await toPdfBuffer(procedure);
    const assets = await persistArtifacts({ procedure, mermaid, bpmnXml, html, pdfBuffer });

    return response(200, {
      procedure,
      artifacts: {
        mermaid,
        bpmnXml,
        html
      },
      assets
    });
  } catch (error) {
    console.error(error);
    return response(500, {
      message: "Falha ao gerar procedimento",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}

function parseBody(event) {
  if (!event.body) {
    return {};
  }

  const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(body);
}

function normalizeRequest(payload) {
  const request = payload && typeof payload === "object" ? payload : {};
  const explicitProcessName = cleanText(request.processName);
  const inferredProcessName = inferProcessName(request.messages);
  const processName = explicitProcessName || inferredProcessName || "Processo nao identificado";

  return {
    ...request,
    processName,
    _hasExplicitProcessName: Boolean(explicitProcessName || inferredProcessName),
    code: cleanText(request.code) || "POP XXX YYY 00",
    revision: cleanText(request.revision) || "00",
    date: cleanText(request.date) || "nao identificado",
    messages: normalizeMessages(request.messages),
    attachments: normalizeAttachments(request.attachments)
  };
}

function hasGenerationContext(payload) {
  return (
    payload._hasExplicitProcessName ||
    payload.messages.some((message) => cleanText(message.content).length >= 3) ||
    payload.attachments.length > 0
  );
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.slice(-30).map((message) => ({
    role: message?.role === "assistant" ? "assistant" : "user",
    content: cleanText(message?.content).slice(0, 4000)
  }));
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments.slice(0, 10).map((attachment) => ({
    name: cleanText(attachment?.name).slice(0, 180) || "arquivo sem nome",
    type: cleanText(attachment?.type).slice(0, 120) || "application/octet-stream",
    size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : 0,
    extraction: cleanText(attachment?.extraction).slice(0, 80) || "metadata-only",
    text: cleanText(attachment?.text).slice(0, 12000)
  }));
}

function inferProcessName(messages) {
  if (!Array.isArray(messages)) {
    return "";
  }

  for (const message of messages.slice().reverse()) {
    const content = cleanText(message?.content);
    const match =
      content.match(/(?:processo|pop|procedimento)\s+(?:de|do|da|para)\s+([^.,;\n]{3,80})/i) ||
      content.match(/gerar\s+(?:um\s+)?pop\s+(?:de|do|da|para)\s+([^.,;\n]{3,80})/i);

    if (match?.[1]) {
      return cleanInferredProcessName(match[1]);
    }
  }

  return "";
}

function cleanInferredProcessName(value) {
  return cleanText(value)
    .replace(/^(?:processo|pop|procedimento)\s+(?:de|do|da|para)\s+/i, "")
    .replace(/\s+(?:com|onde|que|para)\s+.*$/i, "")
    .trim();
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function response(statusCode, body) {
  const allowedOrigin = (process.env.CORS_ALLOW_ORIGIN || "*").split(",")[0] || "*";

  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json"
    },
    body: typeof body === "string" ? body : JSON.stringify(body)
  };
}
