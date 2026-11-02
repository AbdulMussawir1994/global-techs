import { deleteEmployee, getEmployee, updateEmployee } from "@/lib/employees";
import { employeeBody, employeeError, employeeId } from "@/lib/employee-http";
import { EmployeeRepositoryError } from "@/lib/employee-repository";
import { employeePatchSchema } from "@/lib/employee-validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id: rawId } = await context.params;
  try {
    const id = employeeId(rawId);
    const employee = getEmployee(id);
    if (!employee) throw new EmployeeRepositoryError("not_found");
    return Response.json(employee, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return employeeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const id = employeeId((await context.params).id);
    const changes = employeePatchSchema.parse(await employeeBody(request));
    return Response.json(updateEmployee(id, changes));
  } catch (error) {
    return employeeError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    deleteEmployee(employeeId((await context.params).id));
    return Response.json({ success: true });
  } catch (error) {
    return employeeError(error);
  }
}
