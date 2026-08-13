"use strict";

const http = require("http");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;

const ROOT = path.resolve(__dirname, "..");
const LIBRARY_PATH = process.env.RESUME_LIBRARY_PATH
  ? path.resolve(process.env.RESUME_LIBRARY_PATH)
  : path.join(ROOT, "data", "resume-library.json");
const LIBRARY_EXAMPLE_PATH = path.join(ROOT, "data", "resume-library.example.json");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 4173;
const MAX_LIBRARY_BYTES = 5 * 1024 * 1024;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm"
};

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

function validateLibrary(value) {
  if (!value || typeof value !== "object") throw new Error("简历库格式无效。");
  if (!value.profile || typeof value.profile !== "object") throw new Error("简历库缺少基础档案。");
  if (!Array.isArray(value.experiences)) throw new Error("简历库经历格式无效。");
  if (!Array.isArray(value.sources)) throw new Error("简历库原始材料格式无效。");
  return value;
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_LIBRARY_BYTES) throw new Error("简历库文件超过 5MB。");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function ensureLibraryFile() {
  try {
    await fsp.access(LIBRARY_PATH);
  } catch (error) {
    await fsp.mkdir(path.dirname(LIBRARY_PATH), { recursive: true });
    await fsp.copyFile(LIBRARY_EXAMPLE_PATH, LIBRARY_PATH);
  }
}

async function handleLibraryApi(request, response) {
  if (request.method === "GET") {
    const body = await fsp.readFile(LIBRARY_PATH, "utf8");
    send(response, 200, body, MIME_TYPES[".json"]);
    return;
  }

  if (request.method === "PUT") {
    const library = validateLibrary(JSON.parse(await readRequestBody(request)));
    const temporaryPath = `${LIBRARY_PATH}.tmp`;
    await fsp.writeFile(temporaryPath, `${JSON.stringify(library, null, 2)}\n`, "utf8");
    await fsp.rename(temporaryPath, LIBRARY_PATH);
    send(response, 200, JSON.stringify({ ok: true }), MIME_TYPES[".json"]);
    return;
  }

  send(response, 405, "Method Not Allowed");
}

function resolveStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const allowedDataFiles = new Set(["data/jobs.js", "data/resume-library.example.json"]);
  if ((relativePath.startsWith("data/") && !allowedDataFiles.has(relativePath)) || relativePath.startsWith("outputs/")) return null;
  const absolutePath = path.resolve(ROOT, relativePath);
  if (absolutePath !== ROOT && !absolutePath.startsWith(`${ROOT}${path.sep}`)) return null;
  return absolutePath;
}

async function handleStatic(request, response, urlPath) {
  const filePath = resolveStaticPath(urlPath);
  if (!filePath) {
    send(response, 403, "Forbidden");
    return;
  }

  const stats = await fsp.stat(filePath);
  if (!stats.isFile()) {
    send(response, 404, "Not Found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname === "/api/resume-library") {
      await handleLibraryApi(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      send(response, 405, "Method Not Allowed");
      return;
    }
    await handleStatic(request, response, url.pathname);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      send(response, 404, "Not Found");
      return;
    }
    console.error(error);
    send(response, 500, error.message || "Internal Server Error");
  }
});

async function start() {
  await ensureLibraryFile();
  server.listen(PORT, HOST, () => {
    console.log(`履析简历助手已启动：http://${HOST}:${PORT}/`);
    console.log("简历库由 APP 本地服务统一保存；请保持此终端窗口开启。");
  });
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
