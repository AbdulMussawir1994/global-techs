# Global Techs — employee workspace

A responsive employee CRUD application built with Next.js 16, React 19, TypeScript, and SQLite.

## Run locally

Use **Node.js 24 LTS** (the application uses the built-in `node:sqlite` module).

```sh
npm install
npm run dev
```

Open [http://localhost:3000/employee](http://localhost:3000/employee). The home route redirects to the employee directory.

## Features

- Create, view, edit, and delete employee profiles, with confirmation before deletion.
- Search names, emails, roles, and locations; filter by department, status, and employment type.
- Sort and paginate results on the server, with debounced search and cached client requests.
- View live employee, status, and department totals.
- Export matching employees to CSV, with spreadsheet formula protection.
- Accessible dialogs, keyboard controls, form validation, and loading, empty, and error states.
- Server validation, case-insensitive unique email addresses, and parameterized SQL queries.

## Data storage

The SQLite database is created automatically at `data/employees.sqlite`. Fictional sample employees are inserted only when the schema is first created. Deleting every employee does not restore sample data. Changes survive application and browser restarts. The database and its journal files are excluded from Git.

Optionally set `EMPLOYEE_DATABASE_PATH` to an absolute path in `.env.local`:

```dotenv
EMPLOYEE_DATABASE_PATH=D:/app-data/global-techs/employees.sqlite
```

Use a persistent, writable disk for deployment and back up the database. This storage setup targets a single Node.js server; ephemeral serverless filesystems and multiple independently deployed instances require an external shared database. Authentication and user permissions are not included: run locally or behind your organization's authenticated access layer before entering real employee data.

## Structure

```text
app/employee/             Server-rendered directory and error boundary
app/api/employees/        REST endpoints and filtered CSV export
components/employee/      Interactive directory and employee dialogs
lib/                     Shared types, validation, and SQLite repository
tests/                   Isolated validation and persistence tests
```

The server streams the live directory behind a Suspense boundary. The database uses WAL mode, indexes, bounded pagination, and prepared statements. SWR deduplicates browser requests and revalidates after mutations; dialogs load when needed.

## Commands

```sh
npm run dev         # Development server
npm run build       # Production build and framework type checks
npm start           # Serve a completed production build
npm run typecheck   # Generate Next.js types and check TypeScript
npm test            # Isolated data-layer tests
npm run test:smoke  # Production SSR and API check (run build first)
npm run lint        # ESLint
```

## REST API

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/employees` | Paginated employees and directory totals |
| POST | `/api/employees` | Create an employee |
| GET | `/api/employees/:id` | Read one employee |
| PATCH | `/api/employees/:id` | Update employee fields |
| DELETE | `/api/employees/:id` | Delete an employee |
| GET | `/api/employees/export` | Export all matching employees as CSV |

List and export support `search`, `department`, `status`, `type`, and `sort` (`name-asc`, `name-desc`, `newest`, `oldest`). List also supports `page` and `pageSize` (default 8, maximum 100). Mutation failures return a readable `error` and, where applicable, `fieldErrors`. Duplicate email addresses return HTTP 409; invalid input returns 400; missing employees return 404.

Runtime libraries: **lucide-react** for icons, **SWR** for client data caching, **Zod** for validation, and **server-only** to guard database imports. **tsx** runs the TypeScript tests. No separate database service or native dependency compilation is required.

The smoke test starts its own production server on an available loopback port, uses a separate temporary SQLite database, and cleans it up afterward.
