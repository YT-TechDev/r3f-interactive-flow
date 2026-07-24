export const PHASES = ["intro", "work", "contact"] as const;

export type Phase = (typeof PHASES)[number];
