"use client";

import { useFrame } from "@react-three/fiber";

export function useFlowFrame(callback: (progress: number, delta: number) => void): void {
  useFrame((_, delta) => {
    callback(0, delta);
  });
}
