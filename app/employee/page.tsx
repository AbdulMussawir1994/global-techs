import { Suspense } from "react";
import { io } from "next/cache";
import EmployeeWorkspace from "@/components/employee/employee-workspace";
import { listEmployees } from "@/lib/employees";

export const metadata = { title: "Employees · Global Techs" };

async function EmployeeDirectory() {
  // Keep live database records out of the prerendered application shell.
  await io();
  return <EmployeeWorkspace initialData={listEmployees()} />;
}

export default function EmployeePage() {
  return (
    <Suspense fallback={<DirectoryLoading />}>
      <EmployeeDirectory />
    </Suspense>
  );
}

function DirectoryLoading() {
  return (
    <main className="initial-loading" aria-busy="true" aria-label="Loading employees">
      <span className="loading-mark" aria-hidden="true">G</span>
      <p>Getting your workspace ready…</p>
    </main>
  );
}
