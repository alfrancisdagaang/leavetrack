import type { User, UserRole } from "@/lib/db/types";

/**
 * Day 0 mock users. UUIDs match supabase/seed.sql exactly, so Day 1 swaps the data
 * source (a real query) without changing the shape anything consumes.
 */
export const MOCK_USERS = {
  hrAdmin: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Hana Reyes",
    email: "hana.reyes@leavetrack.example",
    role: "hr_admin",
    manager_id: null,
  },
  manager: {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Marco Santos",
    email: "marco.santos@leavetrack.example",
    role: "manager",
    manager_id: "00000000-0000-4000-8000-000000000001",
  },
  employee: {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Elena Cruz",
    email: "elena.cruz@leavetrack.example",
    role: "employee",
    manager_id: "00000000-0000-4000-8000-000000000002",
  },
} as const satisfies Record<string, User>;

/** The user a mock session acts as, per role. */
export const MOCK_USER_BY_ROLE: Record<UserRole, User> = {
  employee: MOCK_USERS.employee,
  manager: MOCK_USERS.manager,
  hr_admin: MOCK_USERS.hrAdmin,
};
