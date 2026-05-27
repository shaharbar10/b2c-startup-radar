import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.argv[2] || 4173);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${port}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const cleanPath = requestedPath === "/"
    ? "index.html"
    : normalize(requestedPath).replace(/^[/\\]+/, "").replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, cleanPath);

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": types.get(extname(filePath)) || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`AMS Startup Radar running at http://localhost:${port}`);
});
