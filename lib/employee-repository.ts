import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { demoEmployees } from "./employee-seed";
import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  STATUSES,
  type Employee,
  type EmployeeInput,
  type EmployeeListResult,
  type EmployeeQuery,
} from "./employee-types";
import { employeePatchSchema, employeeSchema } from "./employee-validation";

const columns = `id, first_name AS firstName, last_name AS lastName, email, role,
  department, status, employment_type AS employmentType, location, phone, joined_at AS joinedAt`;

const insertSql = `INSERT INTO employees
  (first_name, last_name, email, role, department, status, employment_type, location, phone, joined_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const fieldColumns: Record<keyof EmployeeInput, string> = {
  firstName: "first_name", lastName: "last_name", email: "email", role: "role",
  department: "department", status: "status", employmentType: "employment_type",
  location: "location", phone: "phone", joinedAt: "joined_at",
};

function values(employee: EmployeeInput): SQLInputValue[] {
  return [employee.firstName, employee.lastName, employee.email, employee.role,
    employee.department, employee.status, employee.employmentType, employee.location,
    employee.phone, employee.joinedAt];
}

function employeeRow(row: Record<string, unknown>): Employee {
  // node:sqlite rows have a null prototype; React Server Components require plain objects.
  return { ...row } as Employee;
}

export class EmployeeRepositoryError extends Error {
  readonly code = "EMPLOYEE_REPOSITORY_ERROR";

  constructor(public readonly kind: "duplicate" | "not_found") {
    super(kind === "duplicate" ? "An employee with this email already exists." : "Employee not found.");
    this.name = "EmployeeRepositoryError";
  }
}

export function isEmployeeRepositoryError(error: unknown): error is EmployeeRepositoryError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as Record<string, unknown>;
  // The connection is shared across independently compiled SSR and route bundles.
  // Their error constructors differ, so instanceof cannot identify domain errors.
  return candidate.code === "EMPLOYEE_REPOSITORY_ERROR"
    && (candidate.kind === "duplicate" || candidate.kind === "not_found")
    && typeof candidate.message === "string";
}

function translateDatabaseError(error: unknown): never {
  if (error instanceof Error && error.message.includes("UNIQUE constraint failed: employees.email")) {
    throw new EmployeeRepositoryError("duplicate");
  }
  throw error;
}

function positiveInteger(value: string | number | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? Math.min(Math.floor(numeric) || fallback, max)
    : fallback;
}

function buildFilter(query: EmployeeQuery) {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  const search = query.search?.trim().slice(0, 200);
  if (search) {
    // Wildcards supplied by a person are literal characters, not SQL syntax.
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    clauses.push(`(first_name || ' ' || last_name LIKE ? ESCAPE '\\'
      OR email LIKE ? ESCAPE '\\' OR role LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\')`);
    params.push(pattern, pattern, pattern, pattern);
  }
  if (DEPARTMENTS.some((department) => department === query.department)) {
    clauses.push("department = ?");
    params.push(query.department!);
  }
  if (STATUSES.some((status) => status === query.status)) {
    clauses.push("status = ?");
    params.push(query.status!);
  }
  if (EMPLOYMENT_TYPES.some((type) => type === query.type)) {
    clauses.push("employment_type = ?");
    params.push(query.type!);
  }

  let orderBy: string;
  switch (query.sort) {
    case "name-desc": orderBy = "first_name COLLATE NOCASE DESC, last_name COLLATE NOCASE DESC, id DESC"; break;
    case "newest": orderBy = "joined_at DESC, id DESC"; break;
    case "oldest": orderBy = "joined_at ASC, id ASC"; break;
    default: orderBy = "first_name COLLATE NOCASE ASC, last_name COLLATE NOCASE ASC, id ASC";
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params, orderBy };
}

export function openEmployeeDatabase({ path, seed = true }: { path: string; seed?: boolean }) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);

  try {
    database.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    const version = database.prepare("PRAGMA user_version").get() as { user_version: number };
    if (version.user_version > 1) throw new Error("The employee database schema is newer than this application.");
    if (version.user_version === 0) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const existing = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'employees'").get();
        database.exec(`CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          role TEXT NOT NULL,
          department TEXT NOT NULL,
          status TEXT NOT NULL,
          employment_type TEXT NOT NULL,
          location TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          joined_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS employees_department_status ON employees(department, status);
        CREATE INDEX IF NOT EXISTS employees_status ON employees(status);
        CREATE INDEX IF NOT EXISTS employees_type ON employees(employment_type);
        CREATE INDEX IF NOT EXISTS employees_joined ON employees(joined_at, id);
        CREATE INDEX IF NOT EXISTS employees_name ON employees(first_name COLLATE NOCASE, last_name COLLATE NOCASE, id);`);
        if (!existing && seed) {
          const insert = database.prepare(insertSql);
          for (const employee of demoEmployees) insert.run(...values(employeeSchema.parse(employee)));
        }
        database.exec("PRAGMA user_version = 1; COMMIT;");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
  } catch (error) {
    database.close();
    throw error;
  }

  return database;
}

export function createEmployeeRepository(options: { path: string; seed?: boolean }) {
  return createEmployeeRepositoryForDatabase(openEmployeeDatabase(options));
}

export function createEmployeeRepositoryForDatabase(database: DatabaseSync) {
  const find = database.prepare(`SELECT ${columns} FROM employees WHERE id = ?`);
  const insert = database.prepare(`${insertSql} RETURNING ${columns}`);
  const remove = database.prepare("DELETE FROM employees WHERE id = ?");
  const statistics = database.prepare(`SELECT COUNT(*) AS total,
    COALESCE(SUM(status = 'Active'), 0) AS active,
    COALESCE(SUM(status = 'On leave'), 0) AS onLeave,
    COUNT(DISTINCT department) AS departments FROM employees`);

  function getEmployee(id: number): Employee | null {
    const row = find.get(id);
    return row ? employeeRow(row) : null;
  }

  function listEmployees(query: EmployeeQuery = {}): EmployeeListResult {
    const { where, params, orderBy } = buildFilter(query);
    const { total } = database.prepare(`SELECT COUNT(*) AS total FROM employees${where}`).get(...params) as { total: number };
    const pageSize = positiveInteger(query.pageSize, 8, 100);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(positiveInteger(query.page, 1), totalPages);
    const employees = database.prepare(`SELECT ${columns} FROM employees${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize).map(employeeRow);
    const stats = { ...statistics.get() } as EmployeeListResult["stats"];
    return { employees, total, page, pageSize, totalPages, stats };
  }

  function exportEmployees(query: EmployeeQuery = {}): Employee[] {
    const { where, params, orderBy } = buildFilter(query);
    return database.prepare(`SELECT ${columns} FROM employees${where} ORDER BY ${orderBy}`).all(...params).map(employeeRow);
  }

  function createEmployee(input: EmployeeInput): Employee {
    const employee = employeeSchema.parse(input);
    try {
      return employeeRow(insert.get(...values(employee))!);
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  function updateEmployee(id: number, input: Partial<EmployeeInput>): Employee {
    const changes = employeePatchSchema.parse(input);
    const assignments: string[] = [];
    const params: SQLInputValue[] = [];
    // Column names come exclusively from this allowlist. Values are always bound.
    for (const key of Object.keys(fieldColumns) as (keyof EmployeeInput)[]) {
      if (changes[key] !== undefined) {
        assignments.push(`${fieldColumns[key]} = ?`);
        params.push(changes[key]);
      }
    }
    try {
      const employee = database.prepare(`UPDATE employees SET ${assignments.join(", ")} WHERE id = ? RETURNING ${columns}`)
        .get(...params, id);
      if (!employee) throw new EmployeeRepositoryError("not_found");
      return employeeRow(employee);
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  function deleteEmployee(id: number): void {
    if (!remove.run(id).changes) throw new EmployeeRepositoryError("not_found");
  }

  return { listEmployees, exportEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee,
    close: () => database.close() };
}

export type EmployeeRepository = ReturnType<typeof createEmployeeRepository>;
