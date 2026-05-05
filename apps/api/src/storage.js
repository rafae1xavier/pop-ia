import { PutItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";

export async function persistArtifacts({ procedure, mermaid, bpmnXml, html, pdfBuffer }) {
  const id = randomUUID();
  const slug = slugify(procedure.header.processName);
  const baseKey = `procedures/${slug}/${id}`;
  const bucket = process.env.DOCUMENT_BUCKET;
  const table = process.env.PROCEDURE_TABLE;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

  const assets = {
    id,
    baseKey,
    checksum: createHash("sha256").update(pdfBuffer).digest("hex"),
    pdfBase64: pdfBuffer.toString("base64"),
    files: {
      json: `${baseKey}/processo.json`,
      mermaid: `${baseKey}/processo.mmd`,
      bpmn: `${baseKey}/processo.bpmn`,
      html: `${baseKey}/relatorio.html`,
      pdf: `${baseKey}/relatorio.pdf`
    }
  };

  if (bucket) {
    const s3 = new S3Client({ region });
    await Promise.all([
      putObject(s3, bucket, assets.files.json, JSON.stringify(procedure, null, 2), "application/json"),
      putObject(s3, bucket, assets.files.mermaid, mermaid, "text/plain; charset=utf-8"),
      putObject(s3, bucket, assets.files.bpmn, bpmnXml, "application/xml"),
      putObject(s3, bucket, assets.files.html, html, "text/html; charset=utf-8"),
      putObject(s3, bucket, assets.files.pdf, pdfBuffer, "application/pdf")
    ]);
  }

  if (table) {
    const dynamodb = new DynamoDBClient({ region });
    await dynamodb.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          id: { S: id },
          processName: { S: procedure.header.processName },
          code: { S: procedure.header.code },
          revision: { S: procedure.header.revision },
          createdAt: { S: new Date().toISOString() },
          baseKey: { S: baseKey },
          checksum: { S: assets.checksum }
        }
      })
    );
  }

  return assets;
}

async function putObject(client, bucket, key, body, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
}

function slugify(value) {
  const normalized = String(value || "procedimento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "procedimento";
}
