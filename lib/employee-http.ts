import { ZodError } from "zod";
import { isEmployeeRepositoryError } from "./employee-repository";
import type { EmployeeQuery } from "./employee-types";

class RequestError extends Error {}

export function employeeQuery(request: Request): EmployeeQuery {
  const params = new URL(request.url).searchParams;
  return {
    search: params.get("search") ?? undefined,
    department: params.get("department") ?? undefined,
    status: params.get("status") ?? undefined,
    type: params.get("type") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  };
}

export function employeeId(value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new RequestError("Enter a valid employee ID.");
  }
  return Number(value);
}

export async function employeeBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (body.length > 20_000) throw new RequestError("The employee request is too large.");
  try {
    return JSON.parse(body);
  } catch {
    throw new RequestError("Send a valid JSON request body.");
  }
}

export function employeeError(error: unknown): Response {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const field = String(issue.path[0] ?? "form");
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return Response.json({ error: "Please check the employee details.", fieldErrors }, { status: 400 });
  }
  if (isEmployeeRepositoryError(error)) {
    return Response.json({ error: error.message }, { status: error.kind === "duplicate" ? 409 : 404 });
  }
  console.error("Employee request failed:", error);
  return Response.json({ error: "Unable to complete the employee request. Please try again." }, { status: 500 });
}
