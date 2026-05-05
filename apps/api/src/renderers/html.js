export function toHtml(procedure, mermaid) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(procedure.header.processName)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; margin: 32px; }
    header { border: 1px solid #111827; display: grid; grid-template-columns: 1fr 190px; }
    header div { padding: 8px; border-bottom: 1px solid #111827; }
    h1 { font-size: 16px; text-align: center; margin: 8px 0; }
    h2 { font-size: 14px; margin-top: 24px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
    p, li { font-size: 12px; line-height: 1.5; }
    pre { background: #f3f4f6; padding: 12px; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #9ca3af; padding: 6px; vertical-align: top; }
    th { background: #e5e7eb; }
  </style>
</head>
<body>
  <header>
    <div>
      <strong>${escapeHtml(procedure.header.system)}</strong><br />
      ${escapeHtml(procedure.header.processType)}
      <h1>${escapeHtml(procedure.header.processName)}</h1>
    </div>
    <div>
      Codigo: ${escapeHtml(procedure.header.code)}<br />
      Revisao: ${escapeHtml(procedure.header.revision)}<br />
      Data: ${escapeHtml(procedure.header.date)}
    </div>
  </header>

  <h2>1. OBJETIVO</h2>
  <p>${escapeHtml(procedure.objective)}</p>

  <h2>2. DIAGRAMA</h2>
  <pre class="mermaid">${escapeHtml(mermaid)}</pre>

  <h2>3. INDICACAO DO DIAGRAMA</h2>
  ${procedure.detailedFlow.map((item) => `<p><strong>${escapeHtml(item.step)}.</strong> ${escapeHtml(item.description)}</p>`).join("\n")}

  <h2>4. DOCUMENTOS QUE COMPOEM O PROCEDIMENTO</h2>
  <ul>${procedure.documents.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>

  <h2>5. REGISTROS OBRIGATORIOS</h2>
  <table>
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
      </tr>`).join("\n")}
    </tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
