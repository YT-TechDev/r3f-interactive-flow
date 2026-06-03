/* eslint-disable @typescript-eslint/no-empty-object-type -- Required for React JSX namespace augmentation with React Three Fiber. */

import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
