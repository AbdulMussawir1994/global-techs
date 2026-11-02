export const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Product",
  "Marketing",
  "People",
  "Finance",
] as const;

export const STATUSES = ["Active", "On leave", "Inactive"] as const;
export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract"] as const;

export type Employee = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: (typeof DEPARTMENTS)[number];
  status: (typeof STATUSES)[number];
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  location: string;
  phone: string;
  joinedAt: string;
};

export type EmployeeInput = Omit<Employee, "id">;

export type EmployeeQuery = {
  search?: string;
  department?: string;
  status?: string;
  type?: string;
  sort?: string;
  page?: string | number;
  pageSize?: string | number;
};

export type EmployeeListResult = {
  employees: Employee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: { total: number; active: number; onLeave: number; departments: number };
};
