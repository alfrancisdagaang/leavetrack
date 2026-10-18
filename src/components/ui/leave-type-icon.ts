/**
 * The icon and tint for a leave type, shared by the Request leave cards and summary. The three
 * icons are the same ones the dashboard's summary cards use (`sun`, `heart-pulse`,
 * `calendar-minus`). Looked up by the type's name; an unknown type falls back to a neutral look.
 */
export type LeaveTypeLook = { icon: string; tint: string };

const LOOKS: Record<string, LeaveTypeLook> = {
  vacation: { icon: "/icons/sun.svg", tint: "bg-leave-vacation/10" },
  sick: { icon: "/icons/heart-pulse.svg", tint: "bg-leave-sick/10" },
  unpaid: { icon: "/icons/calendar-minus.svg", tint: "bg-leave-unpaid/10" },
};

const FALLBACK: LeaveTypeLook = { icon: "/icons/calendar-minus.svg", tint: "bg-grey-100" };

export function leaveTypeLook(name: string): LeaveTypeLook {
  return LOOKS[name.trim().toLowerCase()] ?? FALLBACK;
}
