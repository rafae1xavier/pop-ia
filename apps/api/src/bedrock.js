import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { parseModelJson } from "./schema.js";

export async function generateProcedureJson(prompt) {
  const modelId = process.env.BEDROCK_MODEL_ID;

  if (!modelId || process.env.DEMO_MODE === "true") {
    return null;
  }

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1"
  });

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(buildBody(modelId, prompt))
  });

  const response = await client.send(command);
  const payload = JSON.parse(Buffer.from(response.body).toString("utf8"));
  const text = extractText(modelId, payload);
  return parseModelJson(text);
}

function isAnthropicModel(modelId) {
  // Suporta model IDs diretos (anthropic.*) e inference profiles (us./eu./ap. + anthropic.*)
  return modelId.includes("anthropic.");
}

function buildBody(modelId, prompt) {
  if (isAnthropicModel(modelId)) {
    return {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: Number(process.env.BEDROCK_MAX_TOKENS || 6000),
      temperature: Number(process.env.BEDROCK_TEMPERATURE || 0.2),
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }]
        }
      ]
    };
  }

  return {
    inputText: prompt,
    textGenerationConfig: {
      maxTokenCount: Number(process.env.BEDROCK_MAX_TOKENS || 6000),
      temperature: Number(process.env.BEDROCK_TEMPERATURE || 0.2),
      topP: 0.9
    }
  };
}

function extractText(modelId, payload) {
  if (isAnthropicModel(modelId)) {
    return (payload.content || [])
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
  }

  if (payload.outputText) {
    return payload.outputText;
  }

  if (Array.isArray(payload.results)) {
    return payload.results.map((result) => result.outputText || result.text || "").join("\n");
  }

  return JSON.stringify(payload);
}
