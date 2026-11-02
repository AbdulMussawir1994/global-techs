import type { EmployeeInput } from "./employee-types";

// Fictional demo records are inserted once, when a new database is created.
export const demoEmployees: EmployeeInput[] = [
  { firstName: "Olivia", lastName: "Rhye", email: "olivia.rhye@example.com", role: "Engineering Manager", department: "Engineering", status: "Active", employmentType: "Full-time", location: "Singapore", phone: "+65 8123 4567", joinedAt: "2023-03-14" },
  { firstName: "Phoenix", lastName: "Baker", email: "phoenix.baker@example.com", role: "Product Designer", department: "Design", status: "Active", employmentType: "Full-time", location: "London, UK", phone: "+44 7700 900123", joinedAt: "2023-05-22" },
  { firstName: "Lana", lastName: "Steiner", email: "lana.steiner@example.com", role: "Product Manager", department: "Product", status: "Active", employmentType: "Full-time", location: "Berlin, Germany", phone: "", joinedAt: "2023-08-07" },
  { firstName: "Demi", lastName: "Wilkinson", email: "demi.wilkinson@example.com", role: "Growth Marketing Lead", department: "Marketing", status: "On leave", employmentType: "Full-time", location: "New York, US", phone: "+1 202 555 0146", joinedAt: "2024-01-15" },
  { firstName: "Drew", lastName: "Cano", email: "drew.cano@example.com", role: "Frontend Engineer", department: "Engineering", status: "Active", employmentType: "Full-time", location: "Singapore", phone: "", joinedAt: "2024-02-12" },
  { firstName: "Natali", lastName: "Craig", email: "natali.craig@example.com", role: "People Partner", department: "People", status: "Active", employmentType: "Full-time", location: "Melbourne, Australia", phone: "+61 491 570 156", joinedAt: "2024-04-08" },
  { firstName: "Orlando", lastName: "Diggs", email: "orlando.diggs@example.com", role: "Financial Analyst", department: "Finance", status: "Active", employmentType: "Full-time", location: "London, UK", phone: "", joinedAt: "2024-06-17" },
  { firstName: "Andi", lastName: "Lane", email: "andi.lane@example.com", role: "Brand Designer", department: "Design", status: "Active", employmentType: "Contract", location: "Remote", phone: "", joinedAt: "2024-09-02" },
  { firstName: "Kai", lastName: "Tan", email: "kai.tan@example.com", role: "Backend Engineer", department: "Engineering", status: "Active", employmentType: "Full-time", location: "Singapore", phone: "+65 8222 3344", joinedAt: "2025-01-06" },
  { firstName: "Amara", lastName: "Okafor", email: "amara.okafor@example.com", role: "Content Strategist", department: "Marketing", status: "Active", employmentType: "Part-time", location: "Remote", phone: "", joinedAt: "2025-03-10" },
  { firstName: "Hugo", lastName: "Laurent", email: "hugo.laurent@example.com", role: "UX Researcher", department: "Design", status: "On leave", employmentType: "Full-time", location: "Paris, France", phone: "", joinedAt: "2025-05-19" },
  { firstName: "Sofia", lastName: "Chen", email: "sofia.chen@example.com", role: "Operations Specialist", department: "People", status: "Inactive", employmentType: "Contract", location: "Toronto, Canada", phone: "+1 416 555 0132", joinedAt: "2025-07-14" },
  { firstName: "Noah", lastName: "Williams", email: "noah.williams@example.com", role: "Platform Engineer", department: "Engineering", status: "Active", employmentType: "Full-time", location: "Austin, US", phone: "", joinedAt: "2026-01-12" },
  { firstName: "Isla", lastName: "Patel", email: "isla.patel@example.com", role: "Product Analyst", department: "Product", status: "Active", employmentType: "Full-time", location: "Singapore", phone: "", joinedAt: "2026-02-09" },
  { firstName: "Ethan", lastName: "Park", email: "ethan.park@example.com", role: "Finance Manager", department: "Finance", status: "Active", employmentType: "Full-time", location: "Seoul, South Korea", phone: "", joinedAt: "2026-04-20" },
  { firstName: "Maya", lastName: "Reed", email: "maya.reed@example.com", role: "Recruiting Coordinator", department: "People", status: "Active", employmentType: "Part-time", location: "Remote", phone: "", joinedAt: "2026-06-01" },
];
