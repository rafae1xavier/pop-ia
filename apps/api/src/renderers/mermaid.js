export function toMermaid(procedure) {
  const lanes = procedure.diagram?.lanes || [];
  const steps = procedure.diagram?.steps || [];
  const decisions = procedure.diagram?.decisions || [];
  const connections = procedure.diagram?.connections || [];

  const lines = ["flowchart TD"];

  const useLanes = lanes.length > 0 && steps.some((s) => s.lane);

  if (useLanes) {
    lines.push(`    START([Inicio])`);
    lines.push(`    END([Fim])`);

    for (const lane of lanes) {
      const laneSteps = steps.filter((s) => s.lane === lane);
      const laneDecisions = decisions.filter((d) => d.lane === lane);
      if (laneSteps.length === 0 && laneDecisions.length === 0) continue;

      lines.push(`    subgraph ${safeId(lane)}["${lane}"]`);
      for (const step of laneSteps) {
        lines.push(`        ${safeId(step.id)}["${escapeLabel(`${step.number} - ${step.title}`)}"]`);
      }
      for (const decision of laneDecisions) {
        lines.push(`        ${safeId(decision.id)}{"${escapeLabel(decision.question)}"}`);
      }
      lines.push(`    end`);
    }
  } else {
    lines.push(`    START([Inicio])`);
    for (const step of steps) {
      lines.push(`    ${safeId(step.id)}["${escapeLabel(`${step.number} - ${step.title}`)}"]`);
    }
    for (const decision of decisions) {
      lines.push(`    ${safeId(decision.id)}{"${escapeLabel(decision.question)}"}`);
    }
    lines.push(`    END([Fim])`);
  }

  const usableConnections = connections.length > 0 ? connections : buildSequentialConnections(steps);
  for (const connection of usableConnections) {
    const from = safeId(connection.from);
    const to = safeId(connection.to);
    const label = connection.label ? `|${escapeLabel(connection.label)}|` : "";
    if (from && to) {
      lines.push(`    ${from} -->${label} ${to}`);
    }
  }

  return lines.join("\n");
}

function buildSequentialConnections(steps) {
  if (steps.length === 0) return [{ from: "START", to: "END" }];
  const connections = [{ from: "START", to: steps[0].id }];
  for (let i = 0; i < steps.length - 1; i++) {
    connections.push({ from: steps[i].id, to: steps[i + 1].id });
  }
  connections.push({ from: steps.at(-1).id, to: "END" });
  return connections;
}

function safeId(value) {
  return String(value || "").replace(/[^A-Za-z0-9_]/g, "_");
}

function escapeLabel(value) {
  return String(value || "")
    .replace(/"/g, "'")
    .replace(/[[\]{}]/g, "()")
    .trim();
}
