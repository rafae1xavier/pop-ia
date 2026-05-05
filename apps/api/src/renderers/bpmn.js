// Layout constants
const POOL_X = 130;
const POOL_Y = 60;
const POOL_LABEL_W = 30;  // vertical process name
const LANE_LABEL_W = 30;  // vertical lane name
const CONTENT_X = POOL_X + POOL_LABEL_W + LANE_LABEL_W;
const LANE_H = 180;
const TASK_W = 120, TASK_H = 80;
const GW_W = 50, GW_H = 50;
const EV_W = 36, EV_H = 36;
const GAP_X = 60;
const MARGIN_RIGHT = 80;

export function toBpmnXml(procedure) {
  const processId = `Process_${slug(procedure.header.processName)}`;
  const collabId = `Collab_${slug(procedure.header.processName)}`;
  const poolId = `Pool_${slug(procedure.header.processName)}`;

  const lanes = (procedure.diagram?.lanes || []).filter(Boolean);
  const steps = procedure.diagram?.steps || [];
  const decisions = procedure.diagram?.decisions || [];
  const connections = (procedure.diagram?.connections || []).filter((c) => c.from && c.to);

  const effectiveLanes = lanes.length > 0 ? lanes : ["Processo"];

  // Map each node to its lane
  const nodeInfo = buildNodeInfo(steps, decisions, effectiveLanes);

  // Topological order for x-axis positioning
  const order = topoSort(nodeInfo, connections);

  // Assign x positions (shared across all lanes)
  const colX = assignColumns(order, nodeInfo);

  // Total pool dimensions
  const totalW = Math.max(...Object.values(colX)) + TASK_W + MARGIN_RIGHT - POOL_X;
  const totalH = effectiveLanes.length * LANE_H;

  // Lane y ranges
  const laneY = {};
  effectiveLanes.forEach((lane, i) => {
    laneY[lane] = POOL_Y + i * LANE_H;
  });

  // Assign final positions
  const pos = {};
  for (const id of order) {
    const info = nodeInfo[id];
    if (!info) continue;
    const x = colX[id];
    const lane = info.lane || effectiveLanes[0];
    const ly = laneY[lane] ?? POOL_Y;
    const cy = ly + LANE_H / 2;
    pos[id] = { x, y: Math.round(cy - info.h / 2), w: info.w, h: info.h, lane };
  }

  // --- Semantic BPMN ---
  const laneSetXml = buildLaneSetXml(effectiveLanes, nodeInfo);
  const nodesXml = buildNodesXml(steps, decisions);
  const flowsXml = connections.map(
    (c, i) =>
      `    <bpmn:sequenceFlow id="Flow_${i + 1}" sourceRef="${xmlId(c.from)}" targetRef="${xmlId(c.to)}"${c.label ? ` name="${xml(c.label)}"` : ""} />`
  );

  // --- DI ---
  const poolShape = `      <bpmndi:BPMNShape id="${poolId}_di" bpmnElement="${poolId}" isHorizontal="true">
        <dc:Bounds x="${POOL_X}" y="${POOL_Y}" width="${totalW}" height="${totalH}" />
      </bpmndi:BPMNShape>`;

  const laneShapes = effectiveLanes.map((lane, i) => {
    const laneId = `Lane_${slug(lane)}`;
    const ly = POOL_Y + i * LANE_H;
    return `      <bpmndi:BPMNShape id="${laneId}_di" bpmnElement="${laneId}" isHorizontal="true">
        <dc:Bounds x="${POOL_X + POOL_LABEL_W}" y="${ly}" width="${totalW - POOL_LABEL_W}" height="${LANE_H}" />
      </bpmndi:BPMNShape>`;
  });

  const elementShapes = order
    .filter((id) => pos[id])
    .map((id) => {
      const p = pos[id];
      const info = nodeInfo[id];
      const labelXml =
        info.type === "gateway"
          ? `\n        <bpmndi:BPMNLabel><dc:Bounds x="${p.x - 10}" y="${p.y + p.h + 4}" width="${p.w + 20}" height="27" /></bpmndi:BPMNLabel>`
          : info.type === "start" || info.type === "end"
            ? `\n        <bpmndi:BPMNLabel><dc:Bounds x="${p.x - 12}" y="${p.y + p.h + 4}" width="60" height="14" /></bpmndi:BPMNLabel>`
            : "";
      return `      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">
        <dc:Bounds x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" />${labelXml}
      </bpmndi:BPMNShape>`;
    });

  const edgeShapes = connections
    .filter((c) => pos[xmlId(c.from)] && pos[xmlId(c.to)])
    .map((c, i) => {
      const from = pos[xmlId(c.from)];
      const to = pos[xmlId(c.to)];
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const y2 = to.y + to.h / 2;
      const midX = Math.round((x1 + x2) / 2);
      const waypoints =
        Math.abs(y1 - y2) > 5
          ? `<di:waypoint x="${x1}" y="${y1}" />\n        <di:waypoint x="${midX}" y="${y1}" />\n        <di:waypoint x="${midX}" y="${y2}" />\n        <di:waypoint x="${x2}" y="${y2}" />`
          : `<di:waypoint x="${x1}" y="${y1}" />\n        <di:waypoint x="${x2}" y="${y2}" />`;
      const labelXml = c.label
        ? `\n        <bpmndi:BPMNLabel><dc:Bounds x="${midX - 20}" y="${Math.min(y1, y2) - 18}" width="40" height="14" /></bpmndi:BPMNLabel>`
        : "";
      return `      <bpmndi:BPMNEdge id="Flow_${i + 1}_di" bpmnElement="Flow_${i + 1}">
        ${waypoints}${labelXml}
      </bpmndi:BPMNEdge>`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1"
  targetNamespace="https://example.com/pop-generator">
  <bpmn:collaboration id="${collabId}">
    <bpmn:participant id="${poolId}" name="${xml(procedure.header.processName)}" processRef="${processId}" />
  </bpmn:collaboration>
  <bpmn:process id="${processId}" name="${xml(procedure.header.processName)}" isExecutable="false">
${laneSetXml}
    <bpmn:startEvent id="START" name="Inicio" />
${nodesXml}
    <bpmn:endEvent id="END" name="Fim" />
${flowsXml.join("\n")}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${collabId}">
${poolShape}
${laneShapes.join("\n")}
${elementShapes.join("\n")}
${edgeShapes.join("\n")}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function buildNodeInfo(steps, decisions, effectiveLanes) {
  const firstLane = effectiveLanes[0] || "Processo";
  const lastLane = effectiveLanes.at(-1) || firstLane;

  const info = {
    START: { type: "start", w: EV_W, h: EV_H, lane: firstLane },
    END: { type: "end", w: EV_W, h: EV_H, lane: lastLane }
  };

  steps.forEach((s) => {
    info[xmlId(s.id)] = { type: "task", w: TASK_W, h: TASK_H, lane: s.lane || firstLane };
  });
  decisions.forEach((d) => {
    info[xmlId(d.id)] = { type: "gateway", w: GW_W, h: GW_H, lane: d.lane || firstLane };
  });

  return info;
}

function buildLaneSetXml(lanes, nodeInfo) {
  const laneSetId = "LaneSet_1";
  const lanesXml = lanes.map((lane) => {
    const laneId = `Lane_${slug(lane)}`;
    const refs = Object.entries(nodeInfo)
      .filter(([, info]) => info.lane === lane)
      .map(([id]) => `      <bpmn:flowNodeRef>${id}</bpmn:flowNodeRef>`)
      .join("\n");
    return `    <bpmn:lane id="${laneId}" name="${xml(lane)}">\n${refs}\n    </bpmn:lane>`;
  });
  return `    <bpmn:laneSet id="${laneSetId}">\n${lanesXml.join("\n")}\n    </bpmn:laneSet>`;
}

function buildNodesXml(steps, decisions) {
  const tasksXml = steps.map(
    (s) => `    <bpmn:task id="${xmlId(s.id)}" name="${xml(`${s.number}. ${s.title}`)}" />`
  );
  const gatewaysXml = decisions.map(
    (d) => `    <bpmn:exclusiveGateway id="${xmlId(d.id)}" name="${xml(d.question)}" isMarkerVisible="true" />`
  );
  return [...tasksXml, ...gatewaysXml].join("\n");
}

function topoSort(nodeInfo, connections) {
  const adj = {};
  const inDegree = {};
  Object.keys(nodeInfo).forEach((id) => { adj[id] = []; inDegree[id] = 0; });

  connections.forEach((c) => {
    const from = xmlId(c.from), to = xmlId(c.to);
    if (adj[from] !== undefined && inDegree[to] !== undefined) {
      adj[from].push(to);
      inDegree[to]++;
    }
  });

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

  Object.keys(nodeInfo).forEach((id) => { if (!visited.has(id)) order.push(id); });
  return order;
}

function assignColumns(order, nodeInfo) {
  const colX = {};
  let x = CONTENT_X + 40;

  for (const id of order) {
    const info = nodeInfo[id] || { w: TASK_W };
    colX[id] = x;
    x += info.w + GAP_X;
  }

  return colX;
}

function xml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function xmlId(value) {
  return String(value || "").replace(/[^A-Za-z0-9_-]/g, "_");
}

function slug(value) {
  return (
    String(value || "procedimento")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "procedimento"
  );
}
