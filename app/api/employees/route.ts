import { createEmployee, listEmployees } from "@/lib/employees";
import { employeeBody, employeeError, employeeQuery } from "@/lib/employee-http";
import { employeeSchema } from "@/lib/employee-validation";

export function GET(request: Request) {
  const query = employeeQuery(request);
  try {
    return Response.json(listEmployees(query), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return employeeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const employee = createEmployee(employeeSchema.parse(await employeeBody(request)));
    return Response.json(employee, { status: 201, headers: { Location: `/api/employees/${employee.id}` } });
  } catch (error) {
    return employeeError(error);
  }
}
