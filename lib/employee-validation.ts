import { z } from "zod";
import { DEPARTMENTS, EMPLOYMENT_TYPES, STATUSES } from "./employee-types";

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), `${label} contains invalid characters.`);

const phoneSchema = z.string().trim().max(30).refine(
  (value) => value === "" || (/^[+()\d .-]+$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7),
  "Enter a valid phone number or leave it blank.",
);

export const employeeSchema = z.object({
  firstName: requiredText("First name", 80),
  lastName: requiredText("Last name", 80),
  email: z.string().trim().max(254).email("Enter a valid email address.").toLowerCase(),
  role: requiredText("Job title", 120),
  department: z.enum(DEPARTMENTS),
  status: z.enum(STATUSES),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  location: requiredText("Location", 120),
  phone: phoneSchema.default(""),
  joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.").refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    "Choose a valid date.",
  ),
}).strict();

export const employeePatchSchema = employeeSchema.extend({ phone: phoneSchema }).partial().refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  "Provide at least one employee field to update.",
);
