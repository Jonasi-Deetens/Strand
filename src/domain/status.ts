import { type Status, STATUSES } from "./types";

/**
 * The status vocabulary is ordered: a procurement line rolls up to the lowest
 * status any of its objects still has, so "40 cabines" only turns green once
 * every cabine on the plan is built.
 */
export const STATUS_ORDER: Record<Status, number> = {
  nodig: 0,
  offerte_aangevraagd: 1,
  offerte_ontvangen: 2,
  besteld: 3,
  geleverd: 4,
  gebouwd: 5,
  vervallen: 6,
};

export const STATUS_COLOUR: Record<Status, string> = {
  nodig: "#94a3b8",
  offerte_aangevraagd: "#f59e0b",
  offerte_ontvangen: "#eab308",
  besteld: "#3b82f6",
  geleverd: "#14b8a6",
  gebouwd: "#22c55e",
  vervallen: "#6b7280",
};

/** Statuses that mean "we actually have it on the beach". */
export const DONE_STATUSES: Status[] = ["geleverd", "gebouwd"];

export function isDone(status: Status): boolean {
  return DONE_STATUSES.includes(status);
}

export function nextStatus(status: Status): Status {
  if (status === "vervallen") return "nodig";
  const index = STATUSES.indexOf(status);
  const next = STATUSES[Math.min(index + 1, STATUS_ORDER.gebouwd)];
  return next ?? status;
}

/**
 * Rolls a set of object statuses up into one line status. Cancelled objects are
 * ignored; an empty or fully cancelled set counts as still needed.
 */
export function rollupStatus(statuses: Status[]): Status {
  const relevant = statuses.filter((s) => s !== "vervallen");
  if (relevant.length === 0) return statuses.length > 0 ? "vervallen" : "nodig";
  return relevant.reduce(
    (lowest, current) =>
      STATUS_ORDER[current] < STATUS_ORDER[lowest] ? current : lowest,
    relevant[0] as Status,
  );
}

/** Share of objects that are delivered or built, 0..1. */
export function completionRatio(statuses: Status[]): number {
  const relevant = statuses.filter((s) => s !== "vervallen");
  if (relevant.length === 0) return 0;
  return relevant.filter(isDone).length / relevant.length;
}
