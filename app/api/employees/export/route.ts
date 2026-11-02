import { employeesToCsv } from "@/lib/employee-csv";
import { employeeError, employeeQuery } from "@/lib/employee-http";
import { exportEmployees } from "@/lib/employees";

export function GET(request: Request) {
  const query = employeeQuery(request);
  try {
    return new Response(employeesToCsv(exportEmployees(query)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="employees.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return employeeError(error);
  }
}
