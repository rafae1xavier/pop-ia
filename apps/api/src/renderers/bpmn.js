const TASK_W = 120, TASK_H = 80;
const GW_W = 50, GW_H = 50;
const EV_W = 36, EV_H = 36;
const GAP_X = 60;
const BASE_Y = 180;

export function toBpmnXml(procedure) {
  const processId = `Process_${slug(procedure.header.processName)}`;
  const steps = procedure.diagram?.steps || [];
  const decisions = procedure.diagram?.decisions || [];
  const connections = (procedure.diagram?.connections || []).filter((c) => c.from && c.to);

  const nodeInfo = buildNodeInfo(steps, decisions);
  const pos = computeLayout(nodeInfo, connections);
  const { shapesXml, edgesXml } = buildDiXml(nodeInfo, pos, connections);

  const semanticNodes = [
    `    <bpmn:startEvent id="START" name="Inicio" />`,
    ...steps.map(
      (s) => `    <bpmn:task id="${xmlId(s.id)}" name="${xml(`${s.number}. ${s.title}`)}" />`
    ),
    ...decisions.map(
      (d) =>
        `    <bpmn:exclusiveGateway id="${xmlId(d.id)}" name="${xml(d.question)}" isMarkerVisible="true" />`
    ),
    `    <bpmn:endEvent id="END" name="Fim" />`
  ];

  const semanticFlows = connections.map(
    (c, i) =>
      `    <bpmn:sequenceFlow id="Flow_${i + 1}" sourceRef="${xmlId(c.from)}" targetRef="${xmlId(c.to)}"${c.label ? ` name="${xml(c.label)}"` : ""} />`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_${processId}"
  targetNamespace="https://example.com/pop-generator">
  <bpmn:process id="${processId}" name="${xml(procedure.header.processName)}" isExecutable="false">
${semanticNodes.join("\n")}
${semanticFlows.join("\n")}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">
${shapesXml}
${edgesXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function buildNodeInfo(steps, decisions) {
  const info = {
    START: { type: "start", w: EV_W, h: EV_H },
    END: { type: "end", w: EV_W, h: EV_H }
  };
  steps.forEach((s) => {
    info[xmlId(s.id)] = { type: "task", w: TASK_W, h: TASK_H };
  });
  decisions.forEach((d) => {
    info[xmlId(d.id)] = { type: "gateway", w: GW_W, h: GW_H };
  });
  return info;
}

function computeLayout(nodeInfo, connections) {
  const adj = {};
  const inDegree = {};
  Object.keys(nodeInfo).forEach((id) => {
    adj[id] = [];
    inDegree[id] = 0;
  });
  connections.forEach((c) => {
    const from = xmlId(c.from);
    const to = xmlId(c.to);
    if (adj[from] !== undefined && inDegree[to] !== undefined) {
      adj[from].push(to);
      inDegree[to]++;
    }
  });

  // Kahn's topological sort
  const queue = Object.keys(nodeInfo).filter((id) => inDegree[id] === 0);
  const order = [];
  const visited = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);
    (adj[id] || []).forEach((next) => {
      inDegree[next]--;
      if (inDegree[next] <= 0) queue.push(next);
    });
  }
  Object.keys(nodeInfo).forEach((id) => {
    if (!visited.has(id)) order.push(id);
  });

  // Detect gateway branches: second outgoing edge goes below baseline
  const outCount = {};
  connections.forEach((c) => {
    const from = xmlId(c.from);
    outCount[from] = (outCount[from] || 0) + 1;
  });

  const branchY = {}; // nodeId -> y offset for branch targets
  connections.forEach((c, i) => {
    const from = xmlId(c.from);
    const to = xmlId(c.to);
    if (nodeInfo[from]?.type === "gateway" && outCount[from] > 1) {
      if (!branchY[from]) {
        branchY[from] = { count: 0 };
      }
      branchY[from].count++;
      if (branchY[from].count > 1) {
        branchY[to] = 150; // second+ edges go down
      }
    }
  });

  const pos = {};
  let x = 80;
  order.forEach((id) => {
    const info = nodeInfo[id] || { w: TASK_W, h: TASK_H };
    const yOffset = branchY[id] || 0;
    pos[id] = {
      x,
      y: BASE_Y - info.h / 2 + yOffset,
      w: info.w,
      h: info.h
    };
    x += info.w + GAP_X;
  });

  return pos;
}

function buildDiXml(nodeInfo, pos, connections) {
  const shapesXml = Object.entries(pos)
    .map(([id, p]) => {
      const type = nodeInfo[id]?.type || "task";
      const labelBlock =
        type === "gateway"
          ? `\n      <bpmndi:BPMNLabel><dc:Bounds x="${p.x - 15}" y="${p.y + p.h + 4}" width="${p.w + 30}" height="27" /></bpmndi:BPMNLabel>`
          : type === "start" || type === "end"
            ? `\n      <bpmndi:BPMNLabel><dc:Bounds x="${p.x - 12}" y="${p.y + p.h + 4}" width="60" height="14" /></bpmndi:BPMNLabel>`
            : "";
      return `      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">\n        <dc:Bounds x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" />${labelBlock}\n      </bpmndi:BPMNShape>`;
    })
    .join("\n");

  const edgesXml = connections
    .filter((c) => pos[xmlId(c.from)] && pos[xmlId(c.to)])
    .map((c, i) => {
      const from = pos[xmlId(c.from)];
      const to = pos[xmlId(c.to)];
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const y2 = to.y + to.h / 2;
      const midX = Math.round((x1 + x2) / 2);
      // If y values differ, add an elbow waypoint
      const waypoints =
        Math.abs(y1 - y2) > 10
          ? `<di:waypoint x="${x1}" y="${y1}" />\n        <di:waypoint x="${midX}" y="${y1}" />\n        <di:waypoint x="${midX}" y="${y2}" />\n        <di:waypoint x="${x2}" y="${y2}" />`
          : `<di:waypoint x="${x1}" y="${y1}" />\n        <di:waypoint x="${x2}" y="${y2}" />`;
      const labelBlock = c.label
        ? `\n        <bpmndi:BPMNLabel><dc:Bounds x="${midX - 25}" y="${Math.min(y1, y2) - 20}" width="50" height="14" /></bpmndi:BPMNLabel>`
        : "";
      return `      <bpmndi:BPMNEdge id="Flow_${i + 1}_di" bpmnElement="Flow_${i + 1}">\n        ${waypoints}${labelBlock}\n      </bpmndi:BPMNEdge>`;
    })
    .join("\n");

  return { shapesXml, edgesXml };
}

function xml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlId(value) {
  return String(value || "").replace(/[^A-Za-z0-9_-]/g, "_");
}

function slug(value) {
  return String(value || "procedimento")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "procedimento";
}
