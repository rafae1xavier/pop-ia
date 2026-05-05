import PDFDocument from "pdfkit";

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 36,
  headerY: 28,
  headerHeight: 92,
  contentTop: 146,
  bottom: 805
};

const BODY_WIDTH = PAGE.width - PAGE.margin * 2;

export function toPdfBuffer(procedure) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE.margin,
      bufferPages: true
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    resetCursor(doc);
    renderPageOne(doc, procedure);

    addContentPage(doc);
    renderDetailedFlow(doc, procedure);

    addContentPage(doc);
    renderDocuments(doc, procedure);
    renderRecords(doc, procedure);

    renderHeaders(doc, procedure);
    doc.end();
  });
}

function renderPageOne(doc, procedure) {
  sectionTitle(doc, "1. OBJETIVO");
  paragraph(doc, procedure.objective, { fontSize: 9.5 });

  sectionTitle(doc, "2. DIAGRAMA");
  drawFlowDiagram(doc, procedure);
}

function renderHeaders(doc, procedure) {
  const range = doc.bufferedPageRange();

  for (let offset = 0; offset < range.count; offset += 1) {
    doc.switchToPage(range.start + offset);
    renderHeader(doc, procedure, `${offset + 1}/${range.count}`);
  }
}

function renderHeader(doc, procedure, page) {
  const x = PAGE.margin;
  const y = PAGE.headerY;
  const w = BODY_WIDTH;
  const h = PAGE.headerHeight;
  const logoW = 72;
  const rightW = 170;
  const centerW = w - logoW - rightW;
  const rowH = h / 3;

  doc.save();
  doc.lineWidth(0.8).strokeColor("#111111");
  doc.rect(x, y, w, h).stroke();
  doc.moveTo(x + logoW, y).lineTo(x + logoW, y + h).stroke();
  doc.moveTo(x + logoW + centerW, y).lineTo(x + logoW + centerW, y + h).stroke();

  for (let index = 1; index < 3; index += 1) {
    doc.moveTo(x + logoW, y + rowH * index).lineTo(x + logoW + centerW, y + rowH * index).stroke();
  }

  for (let index = 1; index < 4; index += 1) {
    doc.moveTo(x + logoW + centerW, y + 23 * index).lineTo(x + w, y + 23 * index).stroke();
  }

  doc.font("Helvetica-Bold").fontSize(6.5).text("Logo", x, y + 40, {
    width: logoW,
    align: "center"
  });

  doc.font("Helvetica-Bold").fontSize(9).text(procedure.header.system.toUpperCase(), x + logoW, y + 10, {
    width: centerW,
    align: "center"
  });
  doc.font("Helvetica-Bold").fontSize(8.5).text(procedure.header.processType.toUpperCase(), x + logoW, y + rowH + 10, {
    width: centerW,
    align: "center"
  });
  doc.font("Helvetica-Bold").fontSize(10).text(procedure.header.processName.toUpperCase(), x + logoW, y + rowH * 2 + 10, {
    width: centerW,
    align: "center"
  });

  const metaX = x + logoW + centerW + 8;
  doc.font("Helvetica").fontSize(8.5);
  doc.text(`Codigo: ${procedure.header.code}`, metaX, y + 7, { width: rightW - 14 });
  doc.text(`Revisao: ${procedure.header.revision}`, metaX, y + 30, { width: rightW - 14 });
  doc.text(`Data da criacao: ${procedure.header.date}`, metaX, y + 53, { width: rightW - 14 });
  doc.text(`Pagina: ${page}`, metaX, y + 76, { width: rightW - 14 });
  doc.restore();
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 34);
  doc.x = PAGE.margin;
  doc.font("Helvetica-Bold").fontSize(12).text(title, PAGE.margin, doc.y, {
    width: BODY_WIDTH
  });
  doc.moveDown(0.45);
}

function paragraph(doc, text, options = {}) {
  const fontSize = options.fontSize || 9;
  const height = doc.font("Helvetica").fontSize(fontSize).heightOfString(text, {
    width: BODY_WIDTH,
    align: "justify",
    lineGap: 2
  });

  ensureSpace(doc, height + 10);
  doc.font("Helvetica").fontSize(fontSize).text(text, PAGE.margin, doc.y, {
    width: BODY_WIDTH,
    align: "justify",
    lineGap: 2
  });
  doc.moveDown(0.6);
}

function drawFlowDiagram(doc, procedure) {
  const lanes = (procedure.diagram.lanes || []).filter(Boolean);
  const steps = procedure.diagram.steps || [];
  const decisions = procedure.diagram.decisions || [];
  const connections = (procedure.diagram.connections || []).filter((c) => c.from && c.to);

  const effectiveLanes = lanes.length > 0 ? lanes : ["Processo"];
  const N = effectiveLanes.length;

  const COL_W = Math.floor(BODY_WIDTH / N);
  const LANE_HEADER_H = 18;
  const BOX_W = Math.min(118, COL_W - 16);
  const BOX_H = 26;
  const GW_W = 60, GW_H = 34;
  const EV_W = 60, EV_H = 20;
  const GAP_Y = 12;

  // lane name → column index
  const laneIdx = {};
  effectiveLanes.forEach((l, i) => { laneIdx[l] = i; });

  // node info
  const nodeCol = { START: 0, END: N - 1 };
  const nodeType = { START: "start", END: "end" };
  const nodeLabel = { START: "Inicio", END: "Fim" };

  steps.forEach((s) => {
    const id = cleanId(s.id);
    nodeCol[id] = laneIdx[s.lane] ?? 0;
    nodeType[id] = "task";
    nodeLabel[id] = `${s.number} - ${s.title}`;
  });
  decisions.forEach((d) => {
    const id = cleanId(d.id);
    nodeCol[id] = laneIdx[d.lane] ?? 0;
    nodeType[id] = "gateway";
    nodeLabel[id] = d.question;
  });

  // BFS level assignment
  const adj = {};
  const allIds = Object.keys(nodeType);
  allIds.forEach((id) => { adj[id] = []; });
  connections.forEach((c) => {
    const from = cleanId(c.from), to = cleanId(c.to);
    if (adj[from] !== undefined && nodeType[to] !== undefined) {
      adj[from].push({ to, label: c.label || "" });
    }
  });

  const level = { START: 0 };
  const queue = ["START"];
  while (queue.length) {
    const id = queue.shift();
    (adj[id] || []).forEach(({ to }) => {
      if (level[to] === undefined) {
        level[to] = (level[id] || 0) + 1;
        queue.push(to);
      }
    });
  }
  allIds.forEach((id) => { if (level[id] === undefined) level[id] = 0; });

  const maxLevel = Math.max(...Object.values(level));
  const rowH = BOX_H + GAP_Y;
  const totalDiagramH = LANE_HEADER_H + (maxLevel + 1) * rowH + GAP_Y + 30;

  ensureSpace(doc, totalDiagramH + 10);
  const startY = doc.y + 4;

  // Draw lane columns
  for (let i = 0; i < N; i++) {
    const colX = PAGE.margin + i * COL_W;
    doc.save();
    if (i % 2 === 0) {
      doc.rect(colX, startY, COL_W, totalDiagramH).fill("#f7f8fa").stroke("#cccccc");
    } else {
      doc.rect(colX, startY, COL_W, totalDiagramH).fill("#ffffff").stroke("#cccccc");
    }
    doc.restore();
    doc.font("Helvetica-Bold").fontSize(6.8).fillColor("#333333").text(effectiveLanes[i], colX + 2, startY + 5, {
      width: COL_W - 4,
      align: "center"
    });
  }
  doc.fillColor("#000000");

  // Compute element positions
  const pos = {};
  allIds.forEach((id) => {
    const col = nodeCol[id] ?? 0;
    const lv = level[id] ?? 0;
    const cx = PAGE.margin + col * COL_W + COL_W / 2;
    const cy = startY + LANE_HEADER_H + GAP_Y + lv * rowH + BOX_H / 2;
    pos[id] = { cx, cy };
  });

  // Draw connections
  doc.lineWidth(0.6).strokeColor("#555555");
  connections.forEach((c, i) => {
    const from = cleanId(c.from), to = cleanId(c.to);
    const fp = pos[from], tp = pos[to];
    if (!fp || !tp) return;

    const fromType = nodeType[from];
    const toType = nodeType[to];
    const fromH = fromType === "gateway" ? GW_H / 2 : fromType === "start" || fromType === "end" ? EV_H / 2 : BOX_H / 2;
    const toH = toType === "gateway" ? GW_H / 2 : toType === "start" || toType === "end" ? EV_H / 2 : BOX_H / 2;

    const x1 = fp.cx, y1 = fp.cy + fromH;
    const x2 = tp.cx, y2 = tp.cy - toH;

    if (Math.abs(x1 - x2) < 4) {
      drawArrow(doc, x1, y1, x2, y2);
    } else {
      const midY = (y1 + y2) / 2;
      drawPolylineArrow(doc, [[x1, y1], [x1, midY], [x2, midY], [x2, y2]]);
    }

    if (c.label) {
      doc.font("Helvetica").fontSize(6).fillColor("#555555")
        .text(c.label, Math.min(x1, x2) - 2, (y1 + y2) / 2 - 8, { width: 30, align: "center" });
      doc.fillColor("#000000");
    }
  });

  // Draw elements
  doc.lineWidth(0.7).strokeColor("#111111");
  allIds.forEach((id) => {
    const p = pos[id];
    if (!p) return;
    const type = nodeType[id];
    const label = nodeLabel[id] || id;

    if (type === "task") {
      drawBox(doc, p.cx - BOX_W / 2, p.cy - BOX_H / 2, BOX_W, BOX_H, label);
    } else if (type === "gateway") {
      drawDiamond(doc, p.cx, p.cy, GW_W, GW_H, label);
    } else {
      drawTerminator(doc, p.cx, p.cy - EV_H / 2, label);
    }
  });

  doc.y = startY + totalDiagramH + 8;
  doc.x = PAGE.margin;
}

function cleanId(value) {
  return String(value || "").replace(/[^A-Za-z0-9_-]/g, "_");
}

function drawBox(doc, x, y, w, h, text) {
  doc.roundedRect(x, y, w, h, 3).stroke("#111111");
  doc.font("Helvetica").fontSize(7.6).text(text, x + 7, y + 8, {
    width: w - 14,
    align: "center",
    height: h - 8
  });
}

function drawTerminator(doc, centerX, y, text) {
  const w = 102;
  const h = 24;
  doc.roundedRect(centerX - w / 2, y, w, h, 12).stroke("#111111");
  doc.font("Helvetica-Bold").fontSize(8).text(text, centerX - w / 2, y + 7, {
    width: w,
    align: "center"
  });
}

function drawDiamond(doc, centerX, centerY, w, h, text) {
  doc
    .moveTo(centerX, centerY - h / 2)
    .lineTo(centerX + w / 2, centerY)
    .lineTo(centerX, centerY + h / 2)
    .lineTo(centerX - w / 2, centerY)
    .closePath()
    .stroke("#111111");
  doc.font("Helvetica").fontSize(7.2).text(text, centerX - w / 2 + 22, centerY - 10, {
    width: w - 44,
    align: "center"
  });
}

function drawArrow(doc, x1, y1, x2, y2) {
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke("#111111");
  drawArrowHead(doc, x1, y1, x2, y2);
}

function drawPolylineArrow(doc, points) {
  if (points.length < 2) {
    return;
  }

  const [startX, startY] = points[0];
  doc.moveTo(startX, startY);
  for (const [x, y] of points.slice(1)) {
    doc.lineTo(x, y);
  }
  doc.stroke("#111111");

  const [x1, y1] = points.at(-2);
  const [x2, y2] = points.at(-1);
  drawArrowHead(doc, x1, y1, x2, y2);
}

function drawArrowHead(doc, x1, y1, x2, y2) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 4;
  doc
    .moveTo(x2, y2)
    .lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6))
    .moveTo(x2, y2)
    .lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6))
    .stroke("#111111");
}

function renderDetailedFlow(doc, procedure) {
  sectionTitle(doc, "3. INDICACAO DO DIAGRAMA");

  for (const item of procedure.detailedFlow) {
    const text = `${item.step}. ${item.description}`;
    const noteText = (item.notes || []).map((note) => `NOTA: ${note}`).join("\n");
    const height = doc.font("Helvetica").fontSize(8.8).heightOfString(text, {
      width: BODY_WIDTH,
      align: "justify",
      lineGap: 2
    });
    ensureSpace(doc, height + 18 + (noteText ? 20 : 0));
    doc.font("Helvetica-Bold").fontSize(8.8).text(`${item.step}. `, PAGE.margin, doc.y, {
      continued: true
    });
    doc.font("Helvetica").fontSize(8.8).text(item.description, {
      width: BODY_WIDTH,
      align: "justify",
      lineGap: 2
    });

    for (const note of item.notes || []) {
      doc.font("Helvetica-Oblique").fontSize(8).text(`NOTA: ${note}`, PAGE.margin + 14, doc.y + 2, {
        width: BODY_WIDTH - 14,
        align: "justify"
      });
    }
    doc.moveDown(0.45);
  }
}

function renderDocuments(doc, procedure) {
  sectionTitle(doc, "4. DOCUMENTOS QUE COMPOEM O PROCEDIMENTO");
  doc.font("Helvetica").fontSize(8.8);
  for (const documentName of procedure.documents) {
    ensureSpace(doc, 16);
    doc.text(`- ${documentName}`, PAGE.margin + 14, doc.y, {
      width: BODY_WIDTH - 14
    });
  }
  doc.moveDown(0.8);
}

function renderRecords(doc, procedure) {
  sectionTitle(doc, "5. REGISTROS OBRIGATORIOS");
  const columns = [90, 80, 65, 75, 100, 70, 43];
  const headers = ["REGISTRO", "ARMAZENAMENTO", "RECUPERAR", "RESPONSAVEL", "ACESSO", "RETENCAO", "DESCARTE"];
  const x = PAGE.margin;
  let y = doc.y;

  ensureSpace(doc, 34);
  drawTableRow(doc, x, y, columns, headers, true, 32);
  y += 32;

  for (const record of procedure.records) {
    const values = [
      record.name,
      record.storage,
      record.retrieval,
      record.owner,
      record.access,
      record.retention,
      record.disposal
    ];
    const rowH = 54;
    if (y + rowH > PAGE.bottom) {
      addContentPage(doc);
      y = doc.y;
      drawTableRow(doc, x, y, columns, headers, true, 32);
      y += 32;
    }
    drawTableRow(doc, x, y, columns, values, false, rowH);
    y += rowH;
  }

  doc.y = y + 8;
  doc.x = PAGE.margin;
}

function drawTableRow(doc, x, y, columns, values, isHeader, height) {
  let cursor = x;
  doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(isHeader ? 6.6 : 6.2);

  for (let index = 0; index < columns.length; index += 1) {
    const width = columns[index];
    doc.rect(cursor, y, width, height).stroke("#111111");
    doc.text(String(values[index] || ""), cursor + 3, y + 5, {
      width: width - 6,
      height: height - 8,
      align: "center"
    });
    cursor += width;
  }
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > PAGE.bottom) {
    addContentPage(doc);
  }
}

function addContentPage(doc) {
  doc.addPage();
  resetCursor(doc);
}

function resetCursor(doc) {
  doc.x = PAGE.margin;
  doc.y = PAGE.contentTop;
}
