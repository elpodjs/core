import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = await mkdtemp(join(tmpdir(), "elpod-package-smoke-"));
const consumer = join(workspace, "consumer");
const tarball = join(workspace, "elpod-smoke.tgz");

try {
  await mkdir(consumer, { recursive: true });
  await writeFile(join(consumer, "package.json"), JSON.stringify({
    name: "elpod-package-smoke",
    private: true,
    type: "module",
  }) + "\n");
  await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      moduleResolution: "bundler",
      types: ["bun"],
      strict: true,
      skipLibCheck: true,
    },
    include: ["src"],
  }, null, 2) + "\n");

  await Bun.$`bun pm pack --filename ${tarball} --quiet`.cwd(root);
  if (!(await Bun.file(tarball).exists())) throw new Error("package tarball was not created");

  await Bun.$`bun install ${tarball}`.cwd(consumer);
  await Bun.$`bun -e ${`
    import { Elysia } from "elysia";
    import { DurableJobDispatcher, EventConsumer, EventOutbox, HttpClient, JobWorker, MemoryEventIdempotencyStore, MemoryJobIdempotencyStore, apiKeyFrom, clientIp, cookieValue, csrfProtection, csrfToken, doctor, etag, inspectorRoutes, negotiateContentType, openTelemetryMetrics, openTelemetryTracer, plugin, safeRedirect, start } from "@elpod/core";
    if (typeof start !== "function" || typeof plugin !== "function" || typeof HttpClient !== "function" || typeof JobWorker !== "function" || typeof DurableJobDispatcher !== "function" || typeof EventConsumer !== "function" || typeof EventOutbox !== "function" || typeof MemoryEventIdempotencyStore !== "function" || typeof MemoryJobIdempotencyStore !== "function" || typeof clientIp !== "function" || typeof negotiateContentType !== "function" || typeof openTelemetryMetrics !== "function" || typeof openTelemetryTracer !== "function" || typeof safeRedirect !== "function" || typeof csrfProtection !== "function" || typeof csrfToken !== "function" || typeof doctor !== "function" || typeof etag !== "function" || typeof inspectorRoutes !== "function") throw new Error("runtime exports missing");
    const request = new Request("http://elpod.test", { headers: { "x-api-key": "key", cookie: "session=value" } });
    if (apiKeyFrom(request) !== "key" || cookieValue(request, "session") !== "value") throw new Error("auth exports failed");
    const app = new Elysia().get("/", () => "ok");
    if (typeof app.handle !== "function") throw new Error("Elysia dependency missing");
  `}`.cwd(consumer);

  console.log("package smoke test passed");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
