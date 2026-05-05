import http from "node:http";
import { handler } from "./index.js";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

if (!process.env.BEDROCK_MODEL_ID) {
  process.env.DEMO_MODE = process.env.DEMO_MODE || "true";
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const body = Buffer.concat(chunks).toString("utf8");

    const result = await handler({
      rawPath: url.pathname,
      headers: req.headers,
      body,
      requestContext: {
        http: {
          method: req.method
        }
      }
    });

    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
  });
});

server.listen(port, host, () => {
  console.log(`API local em http://${host}:${port}`);
});
