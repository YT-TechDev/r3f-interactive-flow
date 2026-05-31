export type EasingFunction = (progress: number) => number;

export function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

export const linear: EasingFunction = (progress) => clamp01(progress);
