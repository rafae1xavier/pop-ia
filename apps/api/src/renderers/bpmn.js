export function toBpmnXml(procedure) {
  const processId = `Process_${slug(procedure.header.processName)}`;
  const steps = procedure.diagram.steps || [];
  const decisions = procedure.diagram.decisions || [];
  const connections = procedure.diagram.connections || [];

  const nodes = [
    '    <bpmn:startEvent id="START" name="Inicio" />',
    ...steps.map((step) => `    <bpmn:task id="${xmlId(step.id)}" name="${xml(`${step.number} - ${step.title}`)}" />`),
    ...decisions.map((decision) => `    <bpmn:exclusiveGateway id="${xmlId(decision.id)}" name="${xml(decision.question)}" />`),
    '    <bpmn:endEvent id="END" name="Fim" />'
  ];

  const flows = connections
    .filter((connection) => connection.from && connection.to)
    .map((connection, index) => {
      const name = connection.label ? ` name="${xml(connection.label)}"` : "";
      return `    <bpmn:sequenceFlow id="Flow_${index + 1}" sourceRef="${xmlId(connection.from)}" targetRef="${xmlId(connection.to)}"${name} />`;
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_${processId}" targetNamespace="https://example.com/pop-generator">
  <bpmn:process id="${processId}" name="${xml(procedure.header.processName)}" isExecutable="false">
${nodes.join("\n")}
${flows.join("\n")}
  </bpmn:process>
</bpmn:definitions>
`;
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
  const normalized = String(value || "procedimento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "procedimento";
}
