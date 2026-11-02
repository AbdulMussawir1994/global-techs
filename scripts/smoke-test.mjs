import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
assert.ok(existsSync(join(project, ".next", "BUILD_ID")), "Run npm run build before the production smoke test.");
const directory = mkdtempSync(join(tmpdir(), "global-techs-smoke-"));

async function availablePort() {
  const probe = createServer();
  await new Promise((accept, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", accept);
  });
  const port = probe.address().port;
  await new Promise((accept, reject) => probe.close((error) => error ? reject(error) : accept()));
  return port;
}

const port = await availablePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [
  join(project, "node_modules", "next", "dist", "bin", "next"),
  "start", "--hostname", "127.0.0.1", "--port", String(port),
], {
  cwd: project,
  env: { ...process.env, EMPLOYEE_DATABASE_PATH: join(directory, "employees.sqlite") },
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
let finished = false;
let startupError;
const closed = new Promise((accept) => {
  server.once("exit", () => { finished = true; accept(); });
  server.once("error", (error) => { startupError = error; finished = true; accept(); });
});
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => { output = (output + chunk).slice(-20000); });
}

async function ready() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !finished) {
    try {
      const response = await fetch(`${base}/icon.svg`, { signal: AbortSignal.timeout(1000) });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch { /* The server may still be starting. */ }
    await new Promise((accept) => setTimeout(accept, 100));
  }
  throw startupError ?? new Error(`Production server did not become ready.\n${output}`);
}

async function json(path, options) {
  const response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(10000) });
  return { status: response.status, body: await response.json() };
}

const options = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

try {
  await ready();
  const home = await fetch(base, { redirect: "manual" });
  assert.equal(home.status, 307);
  assert.equal(home.headers.get("location"), "/employee");

  // Initialize the shared repository through SSR before testing API errors.
  // Next.js can compile the same domain error class into separate route bundles.
  const page = await fetch(`${base}/employee`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Employee directory/);
  assert.match(html, /Andi/);
  assert.doesNotMatch(html, /We couldn.t load your workspace/);

  const initial = await json("/api/employees");
  assert.equal(initial.status, 200);
  assert.equal(initial.body.total, 16);
  assert.equal(initial.body.employees.length, 8);

  const employee = {
    firstName: "API", lastName: "Verification", email: "api.verification@example.test",
    role: "QA Engineer", department: "Engineering", status: "Active",
    employmentType: "Full-time", location: "Singapore", phone: "+65 8123 4567", joinedAt: "2026-11-03",
  };
  const created = await json("/api/employees", options("POST", employee));
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.ok(Number.isSafeInteger(id));
  assert.equal((await json(`/api/employees/${id}`)).body.email, employee.email);

  const duplicate = await json("/api/employees", options("POST", { ...employee, email: employee.email.toUpperCase() }));
  assert.equal(duplicate.status, 409, "Duplicate email must remain an actionable conflict after SSR initializes the database.");
  const invalid = await json("/api/employees", options("POST", { ...employee, email: "invalid" }));
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.fieldErrors.email);

  const updated = await json(`/api/employees/${id}`, options("PATCH", { status: "On leave", role: "QA Lead" }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.role, "QA Lead");
  assert.equal(updated.body.email, employee.email);
  assert.equal((await json(`/api/employees/${id}`, options("PATCH", {}))).status, 400);

  const query = "search=API%20Verification&status=On%20leave&department=Engineering&type=Full-time&page=999";
  const filtered = await json(`/api/employees?${query}`);
  assert.equal(filtered.body.total, 1);
  assert.equal(filtered.body.page, 1);
  assert.equal(filtered.body.stats.total, 17);
  const exported = await fetch(`${base}/api/employees/export?${query}`);
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-type"), /text\/csv/);
  const csv = await exported.text();
  assert.match(csv, /api.verification@example.test/);
  assert.match(csv, /QA Lead/);

  assert.equal((await json("/api/employees/not-an-id")).status, 400);
  assert.equal((await json(`/api/employees/${id}`, { method: "DELETE" })).status, 200);
  assert.equal((await json(`/api/employees/${id}`)).status, 404);
  assert.equal((await json(`/api/employees/${id}`, options("PATCH", { role: "Missing" }))).status, 404);
  assert.equal((await json(`/api/employees/${id}`, { method: "DELETE" })).status, 404);
  assert.equal((await json("/api/employees")).body.total, 16);
  console.log("PASS: production SSR, redirect, CRUD, validation, cross-bundle error handling, filtering, pagination, and CSV export.");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (!finished) server.kill();
  await closed;
  const target = resolve(directory);
  assert.ok(target.startsWith(resolve(tmpdir()) + sep), "Cleanup must remain inside the temporary directory.");
  rmSync(target, { recursive: true, force: true });
}
