import "server-only";
import { resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import {
  createEmployeeRepositoryForDatabase,
  openEmployeeDatabase,
  type EmployeeRepository,
} from "./employee-repository";
import type { EmployeeInput, EmployeeQuery } from "./employee-types";

const globalStore = globalThis as typeof globalThis & {
  employeeDatabase?: DatabaseSync;
  employeeRepository?: EmployeeRepository;
};

// Query methods belong to this module, so hot reload always uses current row mapping.
let repository: EmployeeRepository | undefined;

function getRepository() {
  if (repository) return repository;

  // Dispose of the legacy cache, which retained old query closures across hot reloads.
  if (globalStore.employeeRepository) {
    globalStore.employeeRepository.close();
    delete globalStore.employeeRepository;
  }

  const database = globalStore.employeeDatabase ??= openEmployeeDatabase({
    path: process.env.EMPLOYEE_DATABASE_PATH || resolve(process.cwd(), "data", "employees.sqlite"),
  });
  repository = createEmployeeRepositoryForDatabase(database);
  return repository;
}

export const listEmployees = (query?: EmployeeQuery) => getRepository().listEmployees(query);
export const exportEmployees = (query?: EmployeeQuery) => getRepository().exportEmployees(query);
export const getEmployee = (id: number) => getRepository().getEmployee(id);
export const createEmployee = (input: EmployeeInput) => getRepository().createEmployee(input);
export const updateEmployee = (id: number, input: Partial<EmployeeInput>) => getRepository().updateEmployee(id, input);
export const deleteEmployee = (id: number) => getRepository().deleteEmployee(id);
