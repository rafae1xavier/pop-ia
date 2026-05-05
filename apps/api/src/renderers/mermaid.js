export function toMermaid(procedure) {
  const steps = procedure.diagram.steps || [];
  const decisions = procedure.diagram.decisions || [];
  const connections = procedure.diagram.connections || [];

  const lines = ["flowchart TD", "    START([Inicio])", "    END([Fim])"];

  for (const step of steps) {
    lines.push(`    ${safeId(step.id)}["${escapeLabel(`${step.number} - ${step.title}`)}"]`);
  }

  for (const decision of decisions) {
    lines.push(`    ${safeId(decision.id)}{"${escapeLabel(decision.question)}"}`);
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
  if (steps.length === 0) {
    return [{ from: "START", to: "END" }];
  }

  const connections = [{ from: "START", to: steps[0].id }];
  for (let index = 0; index < steps.length - 1; index += 1) {
    connections.push({ from: steps[index].id, to: steps[index + 1].id });
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
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .trim();
}
