"use client";

import { useFrame } from "@react-three/fiber";

export type FlowFrameCallback = (progress: number, delta: number) => void;

export function useFlowFrame(callback: FlowFrameCallback): void {
  useFrame((_, delta) => {
    callback(0, delta);
  });
}
