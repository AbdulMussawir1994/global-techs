import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { employeesToCsv } from "../lib/employee-csv";
import { employeeBody, employeeError, employeeId, employeeQuery } from "../lib/employee-http";
import {
  createEmployeeRepository,
  createEmployeeRepositoryForDatabase,
  EmployeeRepositoryError,
  isEmployeeRepositoryError,
  openEmployeeDatabase,
} from "../lib/employee-repository";
import type { EmployeeInput } from "../lib/employee-types";
import { employeePatchSchema, employeeSchema } from "../lib/employee-validation";

const input: EmployeeInput = {
  firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", role: "Software Engineer",
  department: "Engineering", status: "Active", employmentType: "Full-time", location: "Singapore",
  phone: "+65 8123 4567", joinedAt: "2026-02-28",
};

test("validation normalizes input and rejects bad data, dates and empty updates", () => {
  assert.equal(employeeSchema.parse({ ...input, firstName: " Ada ", email: " ADA@EXAMPLE.COM " }).email, "ada@example.com");
  assert.equal(employeeSchema.parse({ ...input, firstName: " Ada " }).firstName, "Ada");
  for (const changes of [
    { email: "invalid" }, { firstName: "  " }, { role: "x".repeat(121) }, { location: "" },
    { joinedAt: "2026-02-30" }, { joinedAt: "2025-02-29" }, { joinedAt: "2026-2-1" },
    { department: "Other" }, { status: "Unknown" }, { employmentType: "Other" }, { phone: "call me" },
    { role: "Engineer\nManager" }, { id: 99 },
  ]) assert.equal(employeeSchema.safeParse({ ...input, ...changes }).success, false);
  assert.equal(employeeSchema.safeParse({ ...input, joinedAt: "2024-02-29", phone: "" }).success, true);
  assert.equal(employeePatchSchema.safeParse({}).success, false);
  assert.deepEqual(employeePatchSchema.parse({ role: " Tech Lead " }), { role: "Tech Lead" });
});

test("CRUD preserves unchanged fields, enforces unique emails and handles missing employees", (t) => {
  const repository = createEmployeeRepository({ path: ":memory:", seed: false });
  t.after(() => repository.close());
  const employee = repository.createEmployee(input);
  assert.ok(employee.id > 0);
  assert.deepEqual(repository.getEmployee(employee.id), employee);
  const updated = repository.updateEmployee(employee.id, { role: "Engineering Lead", status: "On leave" });
  assert.equal(updated.role, "Engineering Lead");
  assert.equal(updated.status, "On leave");
  assert.equal(updated.phone, input.phone);
  assert.throws(() => repository.createEmployee({ ...input, email: "ADA@EXAMPLE.COM" }),
    (error) => error instanceof EmployeeRepositoryError && error.kind === "duplicate");
  const second = repository.createEmployee({ ...input, email: "grace@example.com", firstName: "Grace" });
  assert.throws(() => repository.updateEmployee(second.id, { email: input.email }),
    (error) => error instanceof EmployeeRepositoryError && error.kind === "duplicate");
  assert.equal(repository.getEmployee(second.id)?.email, "grace@example.com");
  repository.deleteEmployee(employee.id);
  assert.equal(repository.getEmployee(employee.id), null);
  assert.throws(() => repository.deleteEmployee(employee.id), EmployeeRepositoryError);
  assert.throws(() => repository.updateEmployee(employee.id, { role: "Missing" }), EmployeeRepositoryError);
});

test("search, combined filters, sort, statistics and pagination are consistent", (t) => {
  const repository = createEmployeeRepository({ path: ":memory:" });
  t.after(() => repository.close());
  const initial = repository.listEmployees();
  assert.equal(initial.total, 16);
  assert.equal(initial.employees.length, 8);
  assert.equal(Object.getPrototypeOf(initial.employees[0]), Object.prototype);
  assert.deepEqual(initial.stats, { total: 16, active: 13, onLeave: 2, departments: 6 });
  const filtered = repository.listEmployees({ department: "Design", status: "Active", type: "Contract" });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.employees[0].firstName, "Andi");
  assert.equal(filtered.stats.total, 16);
  assert.equal(repository.listEmployees({ search: "olivia RHYE" }).total, 1);
  assert.equal(repository.listEmployees({ search: "singapore" }).total, 4);
  assert.equal(repository.listEmployees({ search: "product designer" }).total, 1);
  const lastPage = repository.listEmployees({ page: "999", pageSize: "5", sort: "newest" });
  assert.equal(lastPage.page, 4);
  assert.equal(lastPage.totalPages, 4);
  assert.equal(lastPage.employees.length, 1);
  assert.equal(lastPage.employees[0].firstName, "Olivia");
  assert.equal(repository.listEmployees({ sort: "name-desc" }).employees[0].firstName, "Sofia");
  assert.equal(repository.listEmployees({ page: "bad", pageSize: "bad" }).pageSize, 8);
  assert.equal(repository.listEmployees({ page: -1, pageSize: 900 }).pageSize, 100);
  assert.equal(repository.listEmployees({ search: "no matching employee", page: 4 }).page, 1);
  assert.equal(repository.exportEmployees({ pageSize: 1 }).length, 16);
});

test("search wildcards and SQL-looking input are treated as literal employee data", (t) => {
  const repository = createEmployeeRepository({ path: ":memory:", seed: false });
  t.after(() => repository.close());
  repository.createEmployee({ ...input, role: "100% Engineer_One" });
  assert.equal(repository.listEmployees({ search: "%" }).total, 1);
  assert.equal(repository.listEmployees({ search: "_" }).total, 1);
  assert.equal(repository.listEmployees({ search: "' OR 1=1; DROP TABLE employees; --" }).total, 0);
  assert.equal(repository.listEmployees({ search: "\\" }).total, 0);
  assert.equal(repository.listEmployees({ sort: "toString", department: "' OR 1=1 --" }).total, 1);
  assert.equal(repository.listEmployees().total, 1);
});

test("recreated repositories reuse the connection and return only plain client data", (t) => {
  const database = openEmployeeDatabase({ path: ":memory:", seed: false });
  t.after(() => database.close());
  const original = createEmployeeRepositoryForDatabase(database);
  const created = original.createEmployee(input);
  const reloaded = createEmployeeRepositoryForDatabase(database);

  function assertClientData(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) assertClientData(item);
      return;
    }
    assert.equal(Object.getPrototypeOf(value), Object.prototype);
    for (const item of Object.values(value)) assertClientData(item);
  }

  assert.deepEqual(reloaded.getEmployee(created.id), created);
  assertClientData(created);
  assertClientData(reloaded.getEmployee(created.id));
  assertClientData(reloaded.listEmployees());
  assertClientData(reloaded.exportEmployees());
  assertClientData(reloaded.updateEmployee(created.id, { role: "Team Lead" }));
  assert.equal(original.getEmployee(created.id)?.role, "Team Lead");
});

test("records survive reopening, and deleting all employees never reseeds the database", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "global-techs-employees-"));
  const path = join(directory, "employees.sqlite");
  let repository = createEmployeeRepository({ path });
  t.after(() => {
    repository.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep));
    rmSync(target, { recursive: true, force: true });
  });
  const added = repository.createEmployee(input);
  repository.close();
  repository = createEmployeeRepository({ path });
  assert.equal(repository.getEmployee(added.id)?.email, input.email);
  assert.equal(repository.listEmployees().total, 17);
  for (const employee of repository.exportEmployees()) repository.deleteEmployee(employee.id);
  repository.close();
  repository = createEmployeeRepository({ path });
  assert.equal(repository.listEmployees().total, 0);
  assert.deepEqual(repository.listEmployees().stats, { total: 0, active: 0, onLeave: 0, departments: 0 });
});

test("CSV escapes quotes, commas and spreadsheet formulas", () => {
  const csv = employeesToCsv([{ ...input, id: 1, firstName: "=1+1", role: 'Lead "Engineer", Remote', location: " @SUM(1,1)" }]);
  assert.ok(csv.startsWith('\uFEFF"ID","First name"'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"Lead ""Engineer"", Remote"'));
  assert.ok(csv.includes('"\' @SUM(1,1)"'));
  assert.ok(csv.includes('"\'+65 8123 4567"'));
  assert.ok(csv.endsWith("\r\n"));
});

test("HTTP parsing rejects malformed IDs and JSON and returns actionable validation errors", async () => {
  assert.equal(employeeId("12"), 12);
  for (const id of ["0", "-1", "1.2", "1 OR 1=1", "9007199254740992"]) assert.throws(() => employeeId(id));
  await assert.rejects(employeeBody(new Request("http://localhost/api/employees", { method: "POST", body: "invalid" })));
  const query = employeeQuery(new Request("http://localhost/api/employees?search=Ada&type=Full-time&page=2"));
  assert.equal(query.search, "Ada");
  assert.equal(query.type, "Full-time");
  assert.equal(query.page, "2");
  const validation = employeeSchema.safeParse({ ...input, email: "invalid" });
  assert.equal(validation.success, false);
  if (!validation.success) {
    const response = employeeError(validation.error);
    assert.equal(response.status, 400);
    assert.ok((await response.json()).fieldErrors.email.length > 0);
  }
  assert.equal(employeeError(new EmployeeRepositoryError("duplicate")).status, 409);
  assert.equal(employeeError(new EmployeeRepositoryError("not_found")).status, 404);
});

test("HTTP domain errors retain their status across separately compiled bundle constructors", async () => {
  // Model an error created by the globally shared repository's SSR bundle.
  class ForeignRepositoryError extends Error {
    readonly code = "EMPLOYEE_REPOSITORY_ERROR";
    constructor(readonly kind: "duplicate" | "not_found") {
      super(kind === "duplicate" ? "An employee with this email already exists." : "Employee not found.");
      this.name = "EmployeeRepositoryError";
    }
  }

  for (const [kind, status] of [["duplicate", 409], ["not_found", 404]] as const) {
    const error = new ForeignRepositoryError(kind);
    assert.equal(error instanceof EmployeeRepositoryError, false);
    assert.equal(isEmployeeRepositoryError(error), true);
    const response = employeeError(error);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: error.message });
  }
  assert.equal(isEmployeeRepositoryError(new Error("Employee not found.")), false);
  assert.equal(isEmployeeRepositoryError({ code: "EMPLOYEE_REPOSITORY_ERROR", kind: "unknown", message: "Invalid" }), false);
});
