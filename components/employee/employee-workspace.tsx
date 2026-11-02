"use client";

import { useEffect, useId, useState } from "react";
import dynamic from "next/dynamic";
import useSWR, { useSWRConfig } from "swr";
import {
  ArrowDownToLine, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight,
  Building2, Check, ChevronDown, ChevronRight, CircleX, Coffee, Eye,
  Globe2, LayoutGrid, Menu, Pencil, Plus, Search, ShieldCheck, Sparkles,
  Trash2, Users, UserCheck, X,
} from "lucide-react";
import { DEPARTMENTS, EMPLOYMENT_TYPES, type Employee, type EmployeeListResult } from "@/lib/employee-types";
import type { EmployeeDialogState } from "./employee-dialogs";

const EmployeeDialogs = dynamic(() => import("./employee-dialogs"), { ssr: false });
const PAGE_SIZE = 8;
const DEFAULT_SORT = "name-asc";
const departmentColors: Record<string, string> = {
  Engineering: "#7966df", Design: "#dc85a7", Product: "#daa44d",
  Marketing: "#61a6bc", People: "#70aa86", Finance: "#8f9ab8",
};
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

async function fetchEmployees(url: string): Promise<EmployeeListResult> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "We couldn’t load the employee directory. Please try again.");
  }
  return response.json();
}

function employeeInitials(employee: Employee) {
  return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`;
}

export default function EmployeeWorkspace({ initialData }: { initialData: EmployeeListResult }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<EmployeeDialogState>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const searchId = useId();
  const { mutate: mutateDirectoryQueries } = useSWRConfig();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (department) params.set("department", department);
  if (status) params.set("status", status);
  if (employmentType) params.set("type", employmentType);
  const isDefaultQuery = page === 1 && !debouncedSearch && !department && !status && !employmentType && sort === DEFAULT_SORT;
  const { data, error, isLoading, isValidating, mutate } = useSWR<EmployeeListResult>(
    `/api/employees?${params.toString()}`,
    fetchEmployees,
    { fallbackData: isDefaultQuery ? initialData : undefined, keepPreviousData: true, dedupingInterval: 2000, revalidateOnFocus: false },
  );
  const result = data ?? initialData;
  const stats = result.stats;
  const hasFilters = Boolean(search || department || status || employmentType);
  const isUpdating = isLoading || isValidating || search.trim() !== debouncedSearch;
  const firstRecord = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const lastRecord = Math.min(result.page * result.pageSize, result.total);
  const tabCounts: Record<string, number> = {
    "": stats.total,
    Active: stats.active,
    "On leave": stats.onLeave,
    Inactive: Math.max(0, stats.total - stats.active - stats.onLeave),
  };

  function selectStatus(value: string) {
    setStatus(value);
    setPage(1);
    setMobileMenuOpen(false);
  }

  function selectDepartment(value: string) {
    setDepartment(value);
    setPage(1);
    setMobileMenuOpen(false);
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setDepartment("");
    setStatus("");
    setEmploymentType("");
    setPage(1);
    setMobileMenuOpen(false);
  }

  async function handleSaved(message: string) {
    setDialog(null);
    setNotice(message);
    const refresh = mutateDirectoryQueries(
      (key) => typeof key === "string" && key.startsWith("/api/employees?"),
      undefined,
      { revalidate: true },
    );
    if (dialog?.mode === "delete" && result.employees.length === 1 && result.page > 1) {
      setPage(result.page - 1);
    }
    await refresh;
  }

  return (
    <div className="workspace-shell">
      {mobileMenuOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar${mobileMenuOpen ? " sidebar-open" : ""}`} aria-label="Workspace navigation">
        <a className="brand" href="/employee" aria-label="Global Techs employee workspace">
          <span className="brand-mark"><Globe2 size={23} strokeWidth={1.7} /></span>
          <span>global<span className="brand-light">techs</span><span className="brand-period">.</span></span>
        </a>
        <button className="workspace-picker" onClick={clearFilters} aria-label="Show all employees in Global Techs" title="Show all employees">
          <span className="workspace-monogram">G</span>
          <span><strong>Global Techs</strong><small>People workspace</small></span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="primary-nav">
          <button className={`nav-item${!status && !department ? " active" : ""}`} onClick={clearFilters}>
            <Users size={18} /><span>Employees</span><span className="nav-count">{stats.total}</span>
          </button>
          <button className={`nav-item${status === "Active" && !department ? " active" : ""}`} onClick={() => { setDepartment(""); selectStatus("Active"); }}>
            <UserCheck size={18} /><span>Active team</span>
          </button>
          <button className={`nav-item${status === "On leave" && !department ? " active" : ""}`} onClick={() => { setDepartment(""); selectStatus("On leave"); }}>
            <Coffee size={18} /><span>On leave</span>
          </button>
        </nav>
        <div className="nav-section-label department-label">DEPARTMENTS <span>{DEPARTMENTS.length}</span></div>
        <nav className="department-nav" aria-label="Filter by department">
          {DEPARTMENTS.map((name) => (
            <button key={name} className={`nav-item department-nav-item${department === name ? " selected" : ""}`} onClick={() => selectDepartment(department === name ? "" : name)} aria-pressed={department === name}>
              <span className="department-dot" style={{ background: departmentColors[name] }} /><span>{name}</span>
              {department === name && <Check size={14} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="workspace-note-icon"><Sparkles size={18} /></span>
            <strong>People first. Always.</strong>
            <p>A little less admin.<br />A lot more human.</p>
            <span className="workspace-ready"><span /> Workspace ready</span>
          </div>
          <div className="sidebar-footer"><span className="tiny-logo"><Globe2 size={14} /></span> Built for your people <span>✧</span></div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-button mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><Menu size={20} /></button>
            <LayoutGrid size={15} /><span>Workspace</span><ChevronRight size={13} /><strong>Employees</strong>
          </div>
          <div className="topbar-right"><span className="workspace-live"><span /> Local workspace</span><span className="topbar-divider" /><span className="current-user" aria-label="Global Techs workspace">GT</span></div>
        </header>
        <main className="main-content">
          <section className="page-heading" aria-labelledby="page-title">
            <div>
              <div className="eyebrow"><span /> YOUR PEOPLE, YOUR POTENTIAL</div>
              <h1 id="page-title">Great teams start<br className="heading-break" /> with great people<span>.</span></h1>
              <p>A home for everyone who makes your company, your company.</p>
            </div>
            <button className="button button-primary add-employee" onClick={() => setDialog({ mode: "create" })}><Plus size={18} /> Add employee</button>
          </section>
          <section className="stats-grid" aria-label="Employee overview">
            {[
              { label: "Total employees", value: stats.total, description: "The people behind your progress", icon: Users, className: "violet" },
              { label: "Active employees", value: stats.active, description: "Making things happen", icon: UserCheck, className: "green" },
              { label: "On leave", value: stats.onLeave, description: "Taking a well-earned break", icon: Coffee, className: "amber" },
              { label: "Departments", value: stats.departments, description: "Different talents. One team.", icon: Building2, className: "blue" },
            ].map(({ label, value, description, icon: Icon, className }) => (
              <article className={`stat-card stat-${className}`} key={label}>
                <div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={19} strokeWidth={1.7} /></span></div>
                <div className="stat-value">{value.toLocaleString()}</div>
                <p>{description}</p>
              </article>
            ))}
          </section>
          <section className="directory-card" aria-labelledby="directory-heading">
            <div className="directory-heading">
              <div><h2 id="directory-heading">Employee directory <span className="count-pill">{stats.total}</span></h2><p>A great team, all together in one place.</p></div>
              <a className="export-button" href={`/api/employees/export?${params.toString()}`} download><ArrowDownToLine size={16} /><span>Export CSV</span><ArrowUpRight size={13} /></a>
            </div>
            <div className="directory-tabs" role="group" aria-label="Filter employees by status">
              {["", "Active", "On leave", "Inactive"].map((value) => (
                <button key={value} className={`directory-tab${status === value ? " selected" : ""}`} aria-pressed={status === value} onClick={() => selectStatus(value)}>
                  {value || "All employees"}<span>{tabCounts[value]}</span>
                </button>
              ))}
            </div>
            <div className="directory-toolbar">
              <div className="search-field"><Search size={17} /><label className="sr-only" htmlFor={searchId}>Search employees</label><input id={searchId} type="search" placeholder="Search by name, email or role..." value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" />{search && <button className="search-clear" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</div>
              <div className="toolbar-filters">
                <label className={`select-control${department ? " has-value" : ""}`}><Building2 size={15} /><span className="sr-only">Department</span><select aria-label="Department" value={department} onChange={(event) => selectDepartment(event.target.value)}><option value="">All departments</option>{DEPARTMENTS.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={13} /></label>
                <label className={`select-control type-select${employmentType ? " has-value" : ""}`}><span className="sr-only">Employment type</span><select aria-label="Employment type" value={employmentType} onChange={(event) => { setEmploymentType(event.target.value); setPage(1); }}><option value="">All types</option>{EMPLOYMENT_TYPES.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={13} /></label>
                <label className="select-control sort-select"><ArrowDownUp size={14} /><span className="sr-only">Sort employees</span><select aria-label="Sort employees" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDown size={13} /></label>
              </div>
            </div>
            {hasFilters && <div className="filter-summary"><span>{result.total} matching employee{result.total === 1 ? "" : "s"}{department ? ` in ${department}` : ""}</span><button onClick={clearFilters}>Clear filters <X size={12} /></button></div>}
            {error && <div className="directory-error notice notice-error" role="alert"><CircleX size={17} /><span>{error.message}</span><button onClick={() => void mutate()}>Try again</button></div>}
            <div className="table-container" aria-busy={isUpdating}>
              <div className={`table-progress${isUpdating ? " visible" : ""}`} />
              <table className="employee-table">
                <caption className="sr-only">Employee directory. Select an employee to view their details.</caption>
                <thead><tr><th scope="col">Employee <ArrowDownUp size={11} /></th><th scope="col">Department</th><th scope="col">Job title</th><th scope="col">Status</th><th scope="col">Employment</th><th scope="col" className="actions-header"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {result.employees.map((employee) => (
                    <tr key={employee.id}>
                      <td><button className="employee-name-button" title={`${employee.firstName} ${employee.lastName} · ${employee.email}`} onClick={() => setDialog({ mode: "view", employee })}><span className={`avatar avatar-${employee.id % 6}`}>{employeeInitials(employee)}</span><span className="employee-identity"><strong>{employee.firstName} {employee.lastName}</strong><span>{employee.email}</span></span></button></td>
                      <td><span className="table-department"><span className="department-dot" style={{ background: departmentColors[employee.department] || "#8f9ab8" }} />{employee.department}</span><span className="employee-code">GT-{String(employee.id).padStart(4, "0")}</span></td>
                      <td><span className="role-name" title={employee.role}>{employee.role}</span><span className="role-location" title={employee.location}>{employee.location || `Joined ${dateFormatter.format(new Date(`${employee.joinedAt.slice(0, 10)}T00:00:00Z`))}`}</span></td>
                      <td><span className={`status-badge status-${employee.status.toLowerCase().replaceAll(" ", "-")}`}><span />{employee.status}</span></td>
                      <td><span className="employment-type">{employee.employmentType}</span></td>
                      <td><div className="row-actions"><button className="icon-button row-view" aria-label={`View ${employee.firstName} ${employee.lastName}`} title="View employee" onClick={() => setDialog({ mode: "view", employee })}><Eye size={15} /></button><button className="icon-button" aria-label={`Edit ${employee.firstName} ${employee.lastName}`} title="Edit employee" onClick={() => setDialog({ mode: "edit", employee })}><Pencil size={14} /></button><button className="icon-button delete-action" aria-label={`Remove ${employee.firstName} ${employee.lastName}`} title="Remove employee" onClick={() => setDialog({ mode: "delete", employee })}><Trash2 size={14} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.employees.length === 0 && <div className="empty-state"><span className="empty-icon"><Search size={25} /></span><h3>{hasFilters ? "No people found" : "Your next great team starts here"}</h3><p>{hasFilters ? "Try another search or adjust your filters to find your people." : "Add your first employee and bring your people into one place."}</p><button className="button button-secondary" onClick={hasFilters ? clearFilters : () => setDialog({ mode: "create" })}>{hasFilters ? "Clear filters" : "Add your first employee"}</button></div>}
            </div>
            <div className="pagination"><span className="pagination-summary">Showing <strong>{firstRecord}–{lastRecord}</strong> of <strong>{result.total}</strong> employee{result.total === 1 ? "" : "s"}</span><div className="pagination-controls"><button className="pagination-arrow" aria-label="Previous page" disabled={result.page <= 1 || isUpdating} onClick={() => setPage(result.page - 1)}><ArrowLeft size={15} /><span>Previous</span></button><span className="page-indicator">Page <strong>{result.page}</strong> of <strong>{Math.max(1, result.totalPages)}</strong></span><button className="pagination-arrow" aria-label="Next page" disabled={result.page >= result.totalPages || isUpdating} onClick={() => setPage(result.page + 1)}><span>Next</span><ArrowRight size={15} /></button></div></div>
          </section>
          <footer className="main-footer"><span><ShieldCheck size={14} /> A little care for the people behind it all.</span><span>Made for people. Built for possibility. <Sparkles size={13} /></span></footer>
          <span className="sr-only" aria-live="polite">{isUpdating ? "Updating employee directory" : `${result.total} employees found`}</span>
        </main>
      </div>
      {notice && <div className="toast" role="status"><span className="toast-check"><Check size={15} /></span>{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={14} /></button></div>}
      {dialog && <EmployeeDialogs dialog={dialog} onClose={() => setDialog(null)} onSaved={(message) => void handleSaved(message)} />}
    </div>
  );
}
