import { describe, expect, it, vi } from "vitest";

import * as publicApi from ".";
import type * as PublicEntrypointModule from ".";
import indexSource from "./index.ts?raw";
import keyboardInputSource from "./input/useKeyboardInput.ts?raw";
import touchInputSource from "./input/useTouchInput.ts?raw";
import wheelInputSource from "./input/useWheelInput.ts?raw";
import flowProviderSource from "./react/FlowProvider.tsx?raw";
import useFlowSource from "./react/useFlow.ts?raw";
import useFlowProgressSource from "./react/useFlowProgress.ts?raw";
import useFlowFrameSource from "./r3f/useFlowFrame.ts?raw";
import type {
  FlowFrameCallback,
  FlowFrameState,
  FlowInputTarget,
  FlowTransitionBaseOptions,
  FlowTransitionOptions,
  UseKeyboardInputOptions,
  UseTouchInputOptions,
  UseWheelInputOptions
} from ".";

type PublicEntrypoint = typeof PublicEntrypointModule;

const expectedCoreRuntimeExports = [
  "FlowProvider",
  "useFlow",
  "useFlowFrame",
  "useFlowProgress"
] as const satisfies readonly (keyof typeof publicApi)[];

const expectedInputRuntimeExports = [
  "useKeyboardInput",
  "useTouchInput",
  "useWheelInput"
] as const satisfies readonly (keyof typeof publicApi)[];

const expectedRuntimeExports = [
  ...expectedCoreRuntimeExports,
  ...expectedInputRuntimeExports
] as const satisfies readonly (keyof typeof publicApi)[];

const expectedTypeExports = [
  "FlowFrameCallback",
  "FlowFrameState",
  "FlowInputTarget",
  "FlowTransitionBaseOptions",
  "FlowTransitionOptions",
  "UseKeyboardInputOptions",
  "UseTouchInputOptions",
  "UseWheelInputOptions"
] as const;

type ExpectedRuntimeExport = (typeof expectedRuntimeExports)[number];
type RuntimeExportCoverageIsExact = keyof typeof publicApi extends ExpectedRuntimeExport
  ? ExpectedRuntimeExport extends keyof typeof publicApi
    ? true
    : never
  : never;

const runtimeExportCoverageIsExact: RuntimeExportCoverageIsExact = true;

type ExpectedPublicEntrypoint = {
  [Key in ExpectedRuntimeExport]: PublicEntrypoint[Key];
};
type PublicEntrypointCoverageIsExact = PublicEntrypoint extends ExpectedPublicEntrypoint
  ? ExpectedPublicEntrypoint extends PublicEntrypoint
    ? true
    : never
  : never;

const publicEntrypointCoverageIsExact: PublicEntrypointCoverageIsExact = true;

const clientEntryFiles = [
  "index.ts",
  "react/FlowProvider.tsx",
  "react/useFlow.ts",
  "react/useFlowProgress.ts",
  "r3f/useFlowFrame.ts",
  "input/useWheelInput.ts",
  "input/useKeyboardInput.ts",
  "input/useTouchInput.ts"
] as const;

const clientEntrySources = {
  "index.ts": indexSource,
  "react/FlowProvider.tsx": flowProviderSource,
  "react/useFlow.ts": useFlowSource,
  "react/useFlowProgress.ts": useFlowProgressSource,
  "r3f/useFlowFrame.ts": useFlowFrameSource,
  "input/useWheelInput.ts": wheelInputSource,
  "input/useKeyboardInput.ts": keyboardInputSource,
  "input/useTouchInput.ts": touchInputSource
} satisfies Record<(typeof clientEntryFiles)[number], string>;

describe("public API", () => {
  it("exposes the expected core package entrypoint exports", () => {
    for (const exportName of expectedCoreRuntimeExports) {
      expect(publicApi[exportName]).toBeTypeOf("function");
    }
  });

  it("exposes the existing input hook entrypoint exports", () => {
    for (const exportName of expectedInputRuntimeExports) {
      expect(publicApi[exportName]).toBeTypeOf("function");
    }
  });

  it("keeps the runtime entrypoint export surface exact", () => {
    expect(Object.keys(publicApi).sort()).toEqual(expectedRuntimeExports);

    for (const exportName of expectedRuntimeExports) {
      expect(publicApi[exportName as keyof typeof publicApi]).toBeTypeOf("function");
    }
  });

  it("keeps the runtime export coverage exact at type-check time", () => {
    expect(runtimeExportCoverageIsExact).toBe(true);
  });

  it("keeps the full entrypoint value export surface exact at type-check time", () => {
    expect(publicEntrypointCoverageIsExact).toBe(true);
  });

  it("keeps the package entrypoint type exports explicit", () => {
    const typeExportNames = Array.from(indexSource.matchAll(/export type \{([^}]+)\}/g)).flatMap(
      ([, exportList]) =>
        (exportList ?? "")
          .split(",")
          .map((exportName) => exportName.trim())
          .filter(Boolean)
    );

    expect(typeExportNames.sort()).toEqual(expectedTypeExports);
  });

  it("does not expose internal modules or subpath exports from package metadata", async () => {
    const packageJson = (await import("../package.json")) as {
      default: {
        exports: Record<string, unknown>;
      };
    };

    expect(Object.keys(packageJson.default.exports)).toEqual(["."]);
  });

  it("keeps package metadata aligned with generated root entrypoint artifacts", async () => {
    const packageJson = (await import("../package.json")) as {
      default: {
        main: string;
        module: string;
        types: string;
        exports: {
          ".": {
            import: { types: string; default: string };
            require: { types: string; default: string };
          };
        };
        files: string[];
        sideEffects: boolean;
        peerDependencies: Record<string, string>;
        dependencies?: Record<string, string>;
      };
    };

    expect(packageJson.default.main).toBe("./dist/index.cjs");
    expect(packageJson.default.module).toBe("./dist/index.js");
    expect(packageJson.default.types).toBe("./dist/index.d.ts");
    expect(packageJson.default.exports["."]).toEqual({
      import: { types: "./dist/index.d.ts", default: "./dist/index.js" },
      require: { types: "./dist/index.d.cts", default: "./dist/index.cjs" }
    });
    expect(packageJson.default.files).toEqual(["dist", "README.md", "LICENSE", "CHANGELOG.md"]);
    expect(packageJson.default.sideEffects).toBe(false);
    expect(packageJson.default.dependencies).toBeUndefined();
    expect(Object.keys(packageJson.default.peerDependencies).sort()).toEqual([
      "@react-three/fiber",
      "react",
      "react-dom",
      "three"
    ]);
  });

  it("does not require browser APIs at module import time", async () => {
    const originalWindow = globalThis.window;

    vi.resetModules();

    try {
      delete (globalThis as Partial<typeof globalThis>).window;

      await expect(import(".")).resolves.toHaveProperty("useWheelInput");
    } finally {
      Object.assign(globalThis, { window: originalWindow });
    }
  });

  it("marks every client-facing entry file with a use client directive", () => {
    for (const filePath of clientEntryFiles) {
      expect(clientEntrySources[filePath], filePath).toMatch(/^"use client";/);
    }
  });

  it("exposes flow frame types", () => {
    const state: FlowFrameState<"intro"> = {
      phase: "intro",
      phaseIndex: 0,
      progress: 0,
      direction: "none",
      isTransitioning: false
    };
    const callback: FlowFrameCallback<"intro"> = (frameState, delta) => {
      expect(frameState).toBe(state);
      expect(delta).toBe(0.1);
    };

    callback(state, 0.1);
  });

  it("exposes the public input target type", () => {
    const element = {} as HTMLElement;
    const elementTarget: FlowInputTarget = element;
    const windowTarget: FlowInputTarget = {} as Window;
    const refTarget: FlowInputTarget = { current: element };
    const nullableRefTarget: FlowInputTarget = { current: null };

    expect(elementTarget).toBe(element);
    expect(windowTarget).toBeTypeOf("object");
    expect(refTarget.current).toBe(element);
    expect(nullableRefTarget.current).toBeNull();
  });

  it("supports phase-generic flow controls through the public useFlow hook", () => {
    type Phase = "intro" | "work";
    type PublicFlowControls = ReturnType<typeof publicApi.useFlow<Phase>>;

    const controls = {
      phase: "intro",
      phaseIndex: 0,
      progress: 0.25,
      direction: "next",
      isTransitioning: true,
      isLocked: false,
      next: vi.fn(),
      prev: vi.fn(),
      goTo: vi.fn<(phase: Phase) => void>(),
      lock: vi.fn(),
      unlock: vi.fn()
    } satisfies PublicFlowControls;

    controls.goTo("work");

    expect(controls.phase).toBe("intro");
    expect(controls.progress).toBe(0.25);
    expect(controls.goTo).toHaveBeenCalledWith("work");
  });

  it("exposes useFlowProgress as a numeric progress hook", () => {
    type PublicProgress = ReturnType<typeof publicApi.useFlowProgress>;
    const progress = 0.5 satisfies PublicProgress;

    expect(progress).toBe(0.5);
  });

  it("exposes documented input hook option types", () => {
    const inputTarget: FlowInputTarget = { current: {} as HTMLElement };

    const ignoredSelectors = ["[data-flow-ignore]", "input"] as const;
    const wheelOptions: UseWheelInputOptions = {
      target: inputTarget,
      threshold: 40,
      axis: "y",
      cooldown: 250,
      enabled: true,
      preventDefault: true,
      ignore: ignoredSelectors
    };

    const touchOptions: UseTouchInputOptions = {
      target: inputTarget,
      threshold: 50,
      axis: "x",
      cooldown: 300,
      enabled: true,
      preventDefault: true,
      ignore: ignoredSelectors
    };

    const groupedKeyboardOptions: UseKeyboardInputOptions = {
      target: inputTarget,
      keys: {
        next: ["ArrowDown", "PageDown"],
        prev: ["ArrowUp", "PageUp"]
      },
      cooldown: 400,
      ignoreWhenTyping: true,
      enabled: true,
      preventDefault: true
    };

    const compatibilityKeyboardOptions: UseKeyboardInputOptions = {
      target: inputTarget,
      nextKeys: ["ArrowRight"],
      prevKeys: ["ArrowLeft"],
      cooldown: 500,
      ignoreWhenTyping: false,
      enabled: true,
      preventDefault: true
    };

    expect(wheelOptions.axis).toBe("y");
    expect(wheelOptions.cooldown).toBe(250);
    expect(wheelOptions.ignore).toBe(ignoredSelectors);
    expect(touchOptions.axis).toBe("x");
    expect(touchOptions.cooldown).toBe(300);
    expect(touchOptions.ignore).toBe(ignoredSelectors);
    expect(groupedKeyboardOptions.keys?.next).toEqual(["ArrowDown", "PageDown"]);
    expect(groupedKeyboardOptions.keys?.prev).toEqual(["ArrowUp", "PageUp"]);
    expect(compatibilityKeyboardOptions.nextKeys).toEqual(["ArrowRight"]);
    expect(compatibilityKeyboardOptions.prevKeys).toEqual(["ArrowLeft"]);
  });

  it("exposes transition option types", () => {
    const baseOptions: FlowTransitionBaseOptions = {
      duration: 1000,
      cooldown: 500,
      easing: (progress) => progress
    };
    const options: FlowTransitionOptions<"intro" | "work"> = {
      ...baseOptions,
      byPhase: {
        intro: { duration: 1600 },
        work: { cooldown: 800 }
      }
    };

    expect(options.byPhase?.intro?.duration).toBe(1600);
    expect(options.byPhase?.work?.cooldown).toBe(800);

    const optionsWithUnknownPhase: FlowTransitionOptions<"intro" | "work"> = {
      byPhase: {
        intro: { duration: 1600 },
        // @ts-expect-error "missing" is not part of the closed "intro" | "work" phase union.
        missing: { duration: 100 }
      }
    };
    void optionsWithUnknownPhase;
  });
});
