const chatForm = document.querySelector("#chat-form");
const chatLog = document.querySelector("#chat-log");
const chatMessage = document.querySelector("#chat-message");
const fileInput = document.querySelector("#file-input");
const attachButton = document.querySelector("#attach-button");
const generatePopButton = document.querySelector("#generate-pop");
const attachmentList = document.querySelector("#attachment-list");
const statusBox = document.querySelector("#status");
const apiInput = document.querySelector("#api-endpoint");
const processNameInput = document.querySelector("#process-name");
const processCodeInput = document.querySelector("#process-code");
const processRevisionInput = document.querySelector("#process-revision");
const processDateInput = document.querySelector("#process-date");
const documentOutput = document.querySelector("#document");
const diagramOutput = document.querySelector("#diagram-output");
const jsonOutput = document.querySelector("#json-output");
const bpmnOutput = document.querySelector("#bpmn-output");
const downloadPdf = document.querySelector("#download-pdf");
const downloadJson = document.querySelector("#download-json");
const downloadBpmn = document.querySelector("#download-bpmn");

let lastResult = null;
let chatMessages = [];
let attachments = [];
let bpmnViewer = null;

const HISTORY_KEY = "pop-ia-history";
const HISTORY_MAX = 10;

const historyPanel = document.querySelector("#history-panel");
const historyList = document.querySelector("#history-list");

apiInput.value = window.APP_CONFIG?.apiBaseUrl || localStorage.getItem("apiBaseUrl") || "http://localhost:3000";

addChatMessage(
  "assistant",
  "Qual processo vamos documentar? Informe o objetivo, responsaveis, etapas, decisoes, registros e anexos de referencia."
);

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}`).classList.add("active");
  });
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = chatMessage.value.trim();
  if (!message && attachments.length === 0) {
    setStatus("Escreva uma mensagem ou anexe um arquivo.");
    return;
  }

  if (message) {
    addChatMessage("user", message);
    updateProcessNameFromMessage(message);
  }

  chatMessage.value = "";
  addChatMessage("assistant", buildAgentDraftReply(message));
  setStatus("Contexto registrado.");
});

attachButton.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files || []);
  if (files.length === 0) {
    return;
  }

  setStatus("Lendo anexos...");
  for (const file of files) {
    attachments.push(await readAttachment(file));
  }

  renderAttachments();
  addChatMessage("user", `Anexei ${files.length} arquivo(s): ${files.map((file) => file.name).join(", ")}.`);
  addChatMessage("assistant", "Anexos registrados como contexto para o POP.");
  setStatus("Anexos prontos.");
  fileInput.value = "";
});

generatePopButton.addEventListener("click", async () => {
  await generateProcedure();
});

downloadPdf.addEventListener("click", () => {
  if (!lastResult?.assets?.pdfBase64) {
    return;
  }
  downloadBase64(lastResult.assets.pdfBase64, "relatorio.pdf", "application/pdf");
});

downloadJson.addEventListener("click", () => {
  if (!lastResult?.procedure) {
    return;
  }
  downloadText(JSON.stringify(lastResult.procedure, null, 2), "processo.json", "application/json");
});

downloadBpmn.addEventListener("click", () => {
  if (!lastResult?.artifacts?.bpmnXml) {
    return;
  }
  downloadText(lastResult.artifacts.bpmnXml, "processo.bpmn", "application/xml");
});

async function generateProcedure() {
  const apiBaseUrl = apiInput.value.replace(/\/+$/, "");
  localStorage.setItem("apiBaseUrl", apiBaseUrl);

  const payload = {
    processName: processNameInput.value.trim(),
    code: processCodeInput.value.trim(),
    revision: processRevisionInput.value.trim(),
    date: processDateInput.value.trim(),
    messages: chatMessages,
    attachments
  };

  setStatus("Gerando procedimento...");
  setDownloads(false);
  addChatMessage("assistant", "Vou consolidar a conversa e gerar o POP estruturado.");

  try {
    const response = await fetch(apiBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Falha HTTP ${response.status}`);
    }

    lastResult = await response.json();
    renderResult(lastResult);
    saveHistory(lastResult, payload);
    setStatus("Procedimento gerado com sucesso.");
    setDownloads(true);
    addChatMessage("assistant", "POP gerado. Revise a aba Documento e baixe os arquivos quando estiver pronto.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Falha ao gerar procedimento.");
    addChatMessage("assistant", "Nao consegui gerar o POP com os dados atuais.");
  }
}

function addChatMessage(role, content) {
  const cleanContent = content.trim();
  if (!cleanContent) {
    return;
  }

  chatMessages.push({ role, content: cleanContent });
  const item = document.createElement("div");
  item.className = `chat-message ${role === "user" ? "from-user" : "from-agent"}`;
  item.textContent = cleanContent;
  chatLog.appendChild(item);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function buildAgentDraftReply(message) {
  const lower = message.toLowerCase();
  if (lower.includes("gerar") || lower.includes("criar pop") || lower.includes("procedimento")) {
    return "Contexto recebido. Clique em Gerar POP para montar o documento completo.";
  }

  if (attachments.length > 0) {
    return "Contexto atualizado. Os anexos serao usados como referencia na geracao.";
  }

  return "Registrado. Se houver formulários, politicas, fluxos ou exemplos, anexe para enriquecer o POP.";
}

async function readAttachment(file) {
  const metadata = {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    text: "",
    extraction: "metadata-only"
  };

  if (isTextFile(file) && file.size <= 250000) {
    metadata.text = await file.text();
    metadata.extraction = "text";
  } else if (isTextFile(file)) {
    metadata.text = (await file.text()).slice(0, 250000);
    metadata.extraction = "text-truncated";
  }

  return metadata;
}

function renderAttachments() {
  attachmentList.innerHTML = "";

  for (const [index, attachment] of attachments.entries()) {
    const item = document.createElement("div");
    item.className = "attachment-item";
    item.innerHTML = `
      <span>${escapeHtml(attachment.name)}</span>
      <button type="button" aria-label="Remover anexo ${escapeHtml(attachment.name)}">Remover</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      attachments.splice(index, 1);
      renderAttachments();
      setStatus("Anexo removido.");
    });
    attachmentList.appendChild(item);
  }
}

function isTextFile(file) {
  const textExtensions = /\.(txt|md|json|csv|xml|html|yml|yaml|log)$/i;
  return file.type.startsWith("text/") || file.type === "application/json" || textExtensions.test(file.name);
}

function updateProcessNameFromMessage(message) {
  if (processNameInput.value.trim() && processNameInput.value.trim() !== "Auditoria interna") {
    return;
  }

  const match =
    message.match(/(?:processo|pop|procedimento)\s+(?:de|do|da|para)\s+([^.,;\n]{3,80})/i) ||
    message.match(/gerar\s+(?:um\s+)?pop\s+(?:de|do|da|para)\s+([^.,;\n]{3,80})/i);

  if (match?.[1]) {
    processNameInput.value = capitalize(cleanInferredProcessName(match[1]));
  }
}

function cleanInferredProcessName(value) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:processo|pop|procedimento)\s+(?:de|do|da|para)\s+/i, "")
    .replace(/\s+(?:com|onde|que|para)\s+.*$/i, "")
    .trim();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderResult(result) {
  const { procedure, artifacts } = result;
  documentOutput.classList.remove("empty-state");
  documentOutput.innerHTML = renderDocument(procedure);
  jsonOutput.textContent = JSON.stringify(procedure, null, 2);
  bpmnOutput.textContent = artifacts.bpmnXml;
  renderBpmnDiagram(artifacts.bpmnXml);
  renderDiagram(artifacts.mermaid, document.querySelector("#document-diagram-output"));
}

async function renderBpmnDiagram(bpmnXml) {
  if (!bpmnXml || !window.BpmnJS) {
    diagramOutput.textContent = bpmnXml || "";
    return;
  }

  try {
    if (bpmnViewer) {
      bpmnViewer.destroy();
    }
    bpmnViewer = new window.BpmnJS({ container: diagramOutput });
    await bpmnViewer.importXML(bpmnXml);
    bpmnViewer.get("canvas").zoom("fit-viewport");
  } catch (error) {
    console.error("Erro ao renderizar BPMN:", error);
    diagramOutput.textContent = bpmnXml;
  }
}

async function renderDiagram(mermaidText, target) {
  if (!target) {
    return;
  }

  target.textContent = mermaidText;
  if (!window.mermaid) {
    return;
  }

  try {
    const id = `diagram-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const rendered = await window.mermaid.render(id, mermaidText);
    target.innerHTML = rendered.svg;
  } catch (error) {
    console.error(error);
    target.textContent = mermaidText;
  }
}

function renderDocument(procedure) {
  return `
    <div class="document-card">
      <header class="doc-header">
        <div class="doc-title">
          <strong>${escapeHtml(procedure.header.system)}</strong>
          <span>${escapeHtml(procedure.header.processType)}</span>
          <h2>${escapeHtml(procedure.header.processName)}</h2>
        </div>
        <div class="doc-meta">
          <span>Codigo: ${escapeHtml(procedure.header.code)}</span>
          <span>Revisao: ${escapeHtml(procedure.header.revision)}</span>
          <span>Data da criacao: ${escapeHtml(procedure.header.date)}</span>
          <span>Pagina: 1/3</span>
        </div>
      </header>

      <section class="doc-section">
        <h3>1. OBJETIVO</h3>
        <p>${escapeHtml(procedure.objective)}</p>
      </section>

      <section class="doc-section">
        <h3>2. DIAGRAMA</h3>
        <div id="document-diagram-output" class="document-diagram-output"></div>
      </section>

      <section class="doc-section">
        <h3>3. INDICACAO DO DIAGRAMA</h3>
        ${procedure.detailedFlow.map((item) => `<p><strong>${escapeHtml(item.step)}.</strong> ${escapeHtml(item.description)}</p>`).join("")}
      </section>

      <section class="doc-section">
        <h3>4. DOCUMENTOS QUE COMPOEM O PROCEDIMENTO</h3>
        <ul>${procedure.documents.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>

      <section class="doc-section">
        <h3>5. REGISTROS OBRIGATORIOS</h3>
        <table class="records-table">
          <thead>
            <tr>
              <th>Registro</th>
              <th>Armazenamento</th>
              <th>Recuperar</th>
              <th>Responsavel</th>
              <th>Acesso</th>
              <th>Retencao</th>
              <th>Descarte</th>
            </tr>
          </thead>
          <tbody>
            ${procedure.records.map((record) => `<tr>
              <td>${escapeHtml(record.name)}</td>
              <td>${escapeHtml(record.storage)}</td>
              <td>${escapeHtml(record.retrieval)}</td>
              <td>${escapeHtml(record.owner)}</td>
              <td>${escapeHtml(record.access)}</td>
              <td>${escapeHtml(record.retention)}</td>
              <td>${escapeHtml(record.disposal)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

function setStatus(message) {
  statusBox.textContent = message;
}

function setDownloads(enabled) {
  downloadPdf.disabled = !enabled;
  downloadJson.disabled = !enabled;
  downloadBpmn.disabled = !enabled;
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  downloadBlob(blob, filename);
}

function downloadBase64(base64, filename, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  downloadBlob(new Blob([bytes], { type }), filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function saveHistory(result, payload) {
  const history = loadHistory();
  const entry = {
    id: result.assets?.id || Date.now().toString(),
    timestamp: Date.now(),
    processName: result.procedure?.header?.processName || payload.processName || "Sem nome",
    code: result.procedure?.header?.code || payload.code || "",
    date: result.procedure?.header?.date || payload.date || "",
    result
  };

  const filtered = history.filter((h) => h.id !== entry.id);
  const updated = [entry, ...filtered].slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  renderHistory();
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    historyPanel.classList.add("hidden");
    return;
  }

  historyPanel.classList.remove("hidden");
  historyList.innerHTML = "";

  for (const entry of history) {
    const item = document.createElement("div");
    item.className = "history-item";
    item.title = `Clique para restaurar: ${escapeHtml(entry.processName)}`;

    const date = new Date(entry.timestamp).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    item.innerHTML = `
      <span class="history-item-name">${escapeHtml(entry.processName)}</span>
      <span class="history-item-meta">${escapeHtml(date)}</span>
    `;

    item.addEventListener("click", () => {
      lastResult = entry.result;
      renderResult(entry.result);
      setDownloads(true);
      setStatus(`Restaurado: ${entry.processName}`);
    });

    historyList.appendChild(item);
  }
}

renderHistory();
