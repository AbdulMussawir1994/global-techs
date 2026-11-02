"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  STATUSES,
  type Employee,
} from "@/lib/employee-types";

export type EmployeeDialogState =
  | { mode: "create" }
  | { mode: "edit" | "view" | "delete"; employee: Employee }
  | null;

type DialogProps = {
  dialog: EmployeeDialogState;
  onClose: () => void;
  onSaved: (message: string) => void;
};

type OpenDialog = NonNullable<EmployeeDialogState>;
type FormValues = Omit<Employee, "id">;
type FieldErrors = Partial<Record<keyof FormValues, string[]>>;

function initialValues(dialog: OpenDialog): FormValues {
  if (dialog.mode !== "create") {
    const employee = dialog.employee;
    return {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      status: employee.status,
      employmentType: employee.employmentType,
      location: employee.location,
      phone: employee.phone,
      joinedAt: employee.joinedAt,
    };
  }

  return {
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    department: DEPARTMENTS[0],
    status: STATUSES[0],
    employmentType: EMPLOYMENT_TYPES[0],
    location: "",
    phone: "",
    joinedAt: new Date().toLocaleDateString("en-CA"),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function readErrors(value: unknown): FieldErrors {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      ([, errors]) =>
        Array.isArray(errors) && errors.every((error) => typeof error === "string"),
    ),
  );
}

export default function EmployeeDialogs(props: DialogProps) {
  if (!props.dialog) return null;

  const key =
    props.dialog.mode === "create"
      ? "create"
      : `${props.dialog.mode}-${props.dialog.employee.id}`;

  return <EmployeeDialog key={key} {...props} dialog={props.dialog} />;
}

function EmployeeDialog({
  dialog,
  onClose,
  onSaved,
}: Omit<DialogProps, "dialog"> & { dialog: OpenDialog }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const [values, setValues] = useState(() => initialValues(dialog));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const employee = dialog.mode === "create" ? null : dialog.employee;
  const isForm = dialog.mode === "create" || dialog.mode === "edit";

  useEffect(() => {
    const element = dialogRef.current;
    const previousFocus = document.activeElement;
    element?.showModal();

    if (!isForm) headingRef.current?.focus();

    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isForm]);

  function updateField<K extends keyof FormValues>(name: K, value: FormValues[K]) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setFieldErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  async function mutate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError("");
    setFieldErrors({});

    try {
      const response = await fetch(
        dialog.mode === "create" ? "/api/employees" : `/api/employees/${employee!.id}`,
        {
          method:
            dialog.mode === "delete"
              ? "DELETE"
              : dialog.mode === "create"
                ? "POST"
                : "PATCH",
          headers: isForm ? { "Content-Type": "application/json" } : undefined,
          body: isForm ? JSON.stringify(values) : undefined,
        },
      );
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setFieldErrors(readErrors(result?.fieldErrors));
        setError(
          typeof result?.error === "string"
            ? result.error
            : "We couldn't save your changes. Please try again.",
        );
        return;
      }

      onSaved(
        dialog.mode === "delete"
          ? "Employee deleted successfully."
          : dialog.mode === "create"
            ? "Employee added successfully."
            : "Employee updated successfully.",
      );
      onClose();
    } catch {
      setError("We couldn't connect to the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function fieldAttributes(name: keyof FormValues) {
    return {
      id: `${id}-${name}`,
      name,
      "aria-invalid": fieldErrors[name]?.length ? (true as const) : undefined,
      "aria-describedby": fieldErrors[name]?.length ? `${id}-${name}-error` : undefined,
    };
  }

  function fieldError(name: keyof FormValues) {
    return fieldErrors[name]?.length ? (
      <span className="field-error" id={`${id}-${name}-error`}>
        {fieldErrors[name]!.join(" ")}
      </span>
    ) : null;
  }

  const titles = {
    create: "Add a new employee",
    edit: "Edit employee",
    view: "Employee profile",
    delete: "Delete employee?",
  };

  return (
    <dialog
      ref={dialogRef}
      className="dialog-panel"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          ) {
            onClose();
          }
        }
      }}
    >
      <div className="dialog-header">
        <div>
          <p className="dialog-eyebrow">YOUR PEOPLE, ALL IN ONE PLACE</p>
          <h2 ref={headingRef} tabIndex={-1} className="dialog-title" id={`${id}-title`}>
            {titles[dialog.mode]}
          </h2>
          <p className="dialog-description" id={`${id}-description`}>
            {dialog.mode === "delete"
              ? "This will permanently remove this employee from your directory."
              : dialog.mode === "view"
                ? "Contact details and employment information."
                : "Keep your team directory up to date. All fields except phone are required."}
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={pending}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {dialog.mode === "view" && employee ? (
        <>
          <div className="detail-hero">
            <span className="avatar avatar-lg" aria-hidden="true">
              {employee.firstName[0]}{employee.lastName[0]}
            </span>
            <div>
              <h3>{employee.firstName} {employee.lastName}</h3>
              <p>{employee.role}</p>
            </div>
            <span className={`status-badge status-${employee.status.toLowerCase().replaceAll(" ", "-")}`}>
              {employee.status}
            </span>
          </div>
          <dl className="detail-grid">
            {([
              ["Email address", employee.email],
              ["Phone number", employee.phone || "Not provided"],
              ["Department", employee.department],
              ["Employment type", employee.employmentType],
              ["Location", employee.location],
              ["Date joined", formatDate(employee.joinedAt)],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <dt className="detail-label">{label}</dt>
                <dd className="detail-value">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="dialog-footer">
            <button type="button" className="button button-secondary" onClick={onClose}>
              Close profile
            </button>
          </div>
        </>
      ) : (
        <form className="employee-form" onSubmit={mutate} aria-busy={pending}>
          {dialog.mode === "delete" && employee ? (
            <div className="detail-hero">
              <span className="delete-icon"><AlertTriangle size={24} aria-hidden="true" /></span>
              <div>
                <h3>{employee.firstName} {employee.lastName}</h3>
                <p>{employee.email}</p>
              </div>
            </div>
          ) : (
            <div className="form-grid">
              <label className="form-field" htmlFor={`${id}-firstName`}>
                First name
                <input {...fieldAttributes("firstName")} autoFocus required maxLength={80} autoComplete="given-name" placeholder="e.g. Olivia" value={values.firstName} onChange={(event) => updateField("firstName", event.target.value)} disabled={pending} />
                {fieldError("firstName")}
              </label>
              <label className="form-field" htmlFor={`${id}-lastName`}>
                Last name
                <input {...fieldAttributes("lastName")} required maxLength={80} autoComplete="family-name" placeholder="e.g. Rhye" value={values.lastName} onChange={(event) => updateField("lastName", event.target.value)} disabled={pending} />
                {fieldError("lastName")}
              </label>
              <label className="form-field full-width" htmlFor={`${id}-email`}>
                Work email
                <input {...fieldAttributes("email")} type="email" required maxLength={254} autoComplete="email" placeholder="name@company.com" value={values.email} onChange={(event) => updateField("email", event.target.value)} disabled={pending} />
                {fieldError("email")}
              </label>
              <label className="form-field" htmlFor={`${id}-role`}>
                Job title
                <input {...fieldAttributes("role")} required maxLength={120} autoComplete="organization-title" placeholder="e.g. Product Designer" value={values.role} onChange={(event) => updateField("role", event.target.value)} disabled={pending} />
                {fieldError("role")}
              </label>
              <label className="form-field" htmlFor={`${id}-department`}>
                Department
                <select {...fieldAttributes("department")} required value={values.department} onChange={(event) => updateField("department", event.target.value as FormValues["department"])} disabled={pending}>
                  {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
                {fieldError("department")}
              </label>
              <label className="form-field" htmlFor={`${id}-status`}>
                Status
                <select {...fieldAttributes("status")} required value={values.status} onChange={(event) => updateField("status", event.target.value as FormValues["status"])} disabled={pending}>
                  {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                {fieldError("status")}
              </label>
              <label className="form-field" htmlFor={`${id}-employmentType`}>
                Employment type
                <select {...fieldAttributes("employmentType")} required value={values.employmentType} onChange={(event) => updateField("employmentType", event.target.value as FormValues["employmentType"])} disabled={pending}>
                  {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                {fieldError("employmentType")}
              </label>
              <label className="form-field" htmlFor={`${id}-location`}>
                Location
                <input {...fieldAttributes("location")} required maxLength={120} autoComplete="address-level2" placeholder="e.g. San Francisco, US" value={values.location} onChange={(event) => updateField("location", event.target.value)} disabled={pending} />
                {fieldError("location")}
              </label>
              <label className="form-field" htmlFor={`${id}-joinedAt`}>
                Date joined
                <input {...fieldAttributes("joinedAt")} type="date" required value={values.joinedAt.slice(0, 10)} onChange={(event) => updateField("joinedAt", event.target.value)} disabled={pending} />
                {fieldError("joinedAt")}
              </label>
              <label className="form-field full-width" htmlFor={`${id}-phone`}>
                Phone number (optional)
                <input {...fieldAttributes("phone")} type="tel" maxLength={30} autoComplete="tel" placeholder="e.g. +1 415 555 0100" value={values.phone} onChange={(event) => updateField("phone", event.target.value)} disabled={pending} />
                {fieldError("phone")}
              </label>
            </div>
          )}
          {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
          <div className="dialog-footer">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={pending}>Cancel</button>
            <button type="submit" className={`button ${dialog.mode === "delete" ? "button-danger" : "button-primary"}`} disabled={pending}>
              {pending ? <LoaderCircle size={16} className="spinner" aria-hidden="true" /> : null}
              {pending ? "Saving…" : dialog.mode === "delete" ? "Delete employee" : dialog.mode === "create" ? "Add employee" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
