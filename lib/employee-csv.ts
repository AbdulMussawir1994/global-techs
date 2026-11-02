import type { Employee } from "./employee-types";

function cell(value: string | number): string {
  let text = String(value);
  // Keep spreadsheet applications from interpreting employee data as formulas.
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function employeesToCsv(employees: Employee[]): string {
  const header = ["ID", "First name", "Last name", "Email", "Job title", "Department", "Status",
    "Employment type", "Location", "Phone", "Join date"];
  const rows = employees.map((employee) => [employee.id, employee.firstName, employee.lastName,
    employee.email, employee.role, employee.department, employee.status, employee.employmentType,
    employee.location, employee.phone, employee.joinedAt]);
  return "\uFEFF" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
