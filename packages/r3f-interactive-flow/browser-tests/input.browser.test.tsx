import React, { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import {
  FlowProvider,
  useFlow,
  useFlowProgress,
  useKeyboardInput,
  useTouchInput,
  useWheelInput
} from "r3f-interactive-flow";

type TestPhase = "intro" | "work" | "details" | "contact";

type Snapshot = {
  phase: TestPhase;
  phaseIndex: number;
  progress: number;
  direction: string;
  isTransitioning: boolean;
};

type InputOptions = {
  enabled?: boolean;
  ignore?: readonly string[];
  touch?: boolean;
  wheel?: boolean;
  keyboard?: boolean;
  keyboardPreventDefault?: boolean;
  keyboardIgnoreWhenTyping?: boolean;
};

const phases = ["intro", "work", "details", "contact"] as const;
const keyboardKeys = {
  next: ["ArrowDown", " ", "Enter"],
  prev: ["ArrowUp"]
} as const;

let container: HTMLDivElement | undefined;
let root: Root | undefined;

beforeAll(() => {
  console.info(`browser user agent: ${navigator.userAgent}`);
});

afterEach(() => {
  if (root !== undefined) {
    act(() => {
      root?.unmount();
    });
  }

  container?.remove();
  root = undefined;
  container = undefined;
});

function InputLayer({
  enabled = true,
  ignore = [],
  touch = false,
  wheel = true,
  keyboard = false,
  keyboardPreventDefault = true,
  keyboardIgnoreWhenTyping = true
}: InputOptions) {
  useWheelInput<TestPhase>({ threshold: 40, cooldown: 0, enabled: enabled && wheel, ignore });
  useTouchInput<TestPhase>({ threshold: 40, cooldown: 0, enabled: enabled && touch, ignore });
  useKeyboardInput<TestPhase>({
    keys: keyboardKeys,
    cooldown: 0,
    enabled: enabled && keyboard,
    preventDefault: keyboardPreventDefault,
    ignoreWhenTyping: keyboardIgnoreWhenTyping
  });

  return null;
}

function StateProbe() {
  const flow = useFlow<TestPhase>();
  const progress = useFlowProgress();

  return (
    <output data-testid="state">
      {JSON.stringify({
        phase: flow.phase,
        phaseIndex: flow.phaseIndex,
        progress,
        direction: flow.direction,
        isTransitioning: flow.isTransitioning
      })}
    </output>
  );
}

function FlowControls() {
  const flow = useFlow<TestPhase>();
  const nextClickCount = React.useRef(0);

  return (
    <div data-testid="flow-controls">
      <button
        data-testid="flow-prev"
        type="button"
        onClick={flow.prev}
        disabled={flow.phaseIndex === 0}
      >
        Previous
      </button>
      <button
        data-testid="flow-next"
        type="button"
        onClick={() => {
          nextClickCount.current += 1;
          flow.next();
        }}
        disabled={flow.phaseIndex === phases.length - 1}
      >
        Next
      </button>
      <output data-testid="flow-next-clicks">{nextClickCount.current}</output>
    </div>
  );
}

function KeyboardTargets() {
  const [buttonClicks, setButtonClicks] = React.useState(0);
  const [anchorClicks, setAnchorClicks] = React.useState(0);

  return (
    <div data-testid="keyboard-targets">
      <button
        data-testid="native-button"
        type="button"
        onClick={() => setButtonClicks((count) => count + 1)}
      >
        <span data-testid="native-button-child">button child</span>
      </button>
      <output data-testid="button-clicks">{buttonClicks}</output>
      <a
        data-testid="native-anchor"
        href="#native-anchor-target"
        onClick={(event) => {
          event.preventDefault();
          setAnchorClicks((count) => count + 1);
        }}
      >
        <span data-testid="native-anchor-child">anchor child</span>
      </a>
      <output data-testid="anchor-clicks">{anchorClicks}</output>
      <label>
        Checkbox
        <input data-testid="native-checkbox" type="checkbox" />
      </label>
      <input data-testid="text-input" />
      <div contentEditable data-testid="keyboard-editable" suppressContentEditableWarning>
        <span data-testid="keyboard-editable-child">editable child</span>
      </div>
      <div data-testid="neutral-focus" tabIndex={0}>
        neutral focus target
      </div>
    </div>
  );
}

function Targets() {
  return (
    <div data-testid="host">
      <button data-testid="button" type="button">
        <span data-testid="button-child">button child</span>
      </button>
      <div contentEditable data-testid="editable" suppressContentEditableWarning>
        <span data-testid="editable-child">editable child</span>
      </div>
      <div data-flow-ignore data-testid="ignored">
        <span data-testid="ignored-child">ignored child</span>
      </div>
      <div data-testid="neutral">
        <span data-testid="neutral-child">neutral child</span>
      </div>
    </div>
  );
}

function App({ children, inputOptions }: { children?: ReactNode; inputOptions?: InputOptions }) {
  return (
    <FlowProvider<TestPhase> phases={phases} transitionDurationMs={0} cooldownMs={0}>
      {inputOptions === undefined ? null : <InputLayer {...inputOptions} />}
      <StateProbe />
      {children}
    </FlowProvider>
  );
}

function mount(ui: ReactNode): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(ui);
  });
}

function rerender(ui: ReactNode): void {
  act(() => {
    root?.render(ui);
  });
}

function getByTestId(testId: string): HTMLElement {
  const element = container?.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  if (element === undefined || element === null) {
    throw new Error(`Missing test element: ${testId}`);
  }

  return element;
}

function readSnapshot(): Snapshot {
  return JSON.parse(getByTestId("state").textContent ?? "{}");
}

type KeyboardController = ReturnType<typeof userEvent.setup>;

async function pressKey(keyboard: KeyboardController, keys: string): Promise<void> {
  await act(async () => {
    await keyboard.keyboard(keys);
  });
}

function dispatchWheel(target: Element, deltaY: number): { event: WheelEvent; result: boolean } {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY
  });
  let result = true;

  act(() => {
    result = target.dispatchEvent(event);
  });

  return { event, result };
}

function createTouch(target: EventTarget, clientY: number): Touch {
  return new Touch({ identifier: 1, target, clientX: 0, clientY });
}

function dispatchTouch(
  target: Element,
  type: "touchstart" | "touchmove",
  clientY: number
): { event: TouchEvent; result: boolean } {
  const touch = createTouch(target, clientY);
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: [touch],
    targetTouches: [touch],
    changedTouches: [touch]
  });
  let result = true;

  act(() => {
    result = target.dispatchEvent(event);
  });

  return { event, result };
}

describe("Chromium input event smoke coverage", () => {
  it("cancels accepted wheel navigation and leaves rejected wheel input unprevented", () => {
    mount(
      <App inputOptions={{ wheel: true }}>
        <Targets />
      </App>
    );

    const accepted = dispatchWheel(getByTestId("neutral-child"), 41);

    expect(readSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false
    });
    expect(accepted.event.defaultPrevented).toBe(true);
    expect(accepted.result).toBe(false);

    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;
    mount(
      <App inputOptions={{ wheel: true }}>
        <Targets />
      </App>
    );

    const rejected = dispatchWheel(getByTestId("neutral-child"), -41);

    expect(readSnapshot().phase).toBe("intro");
    expect(rejected.event.defaultPrevented).toBe(false);
    expect(rejected.result).toBe(true);
  });

  it("cancels accepted touch navigation and leaves rejected touch input unprevented", () => {
    mount(
      <App inputOptions={{ touch: true, wheel: false }}>
        <Targets />
      </App>
    );

    const neutral = getByTestId("neutral-child");
    dispatchTouch(neutral, "touchstart", 100);
    const accepted = dispatchTouch(neutral, "touchmove", 59);

    expect(readSnapshot()).toEqual({
      phase: "work",
      phaseIndex: 1,
      progress: 1,
      direction: "none",
      isTransitioning: false
    });
    expect(accepted.event.defaultPrevented).toBe(true);
    expect(accepted.result).toBe(false);

    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;
    mount(
      <App inputOptions={{ touch: true, wheel: false }}>
        <Targets />
      </App>
    );

    const rejectedTarget = getByTestId("neutral-child");
    dispatchTouch(rejectedTarget, "touchstart", 100);
    const rejected = dispatchTouch(rejectedTarget, "touchmove", 141);

    expect(readSnapshot().phase).toBe("intro");
    expect(rejected.event.defaultPrevented).toBe(false);
    expect(rejected.result).toBe(true);
  });

  it("preserves nested actionable, editable, and ignored ancestry while accepting neutral wheel input", () => {
    mount(
      <App inputOptions={{ wheel: true, ignore: ["[data-flow-ignore]"] }}>
        <Targets />
      </App>
    );

    for (const testId of ["button-child", "editable-child", "ignored-child"] as const) {
      const event = dispatchWheel(getByTestId(testId), 41);

      expect(readSnapshot().phase).toBe("intro");
      expect(event.event.defaultPrevented).toBe(false);
      expect(event.result).toBe(true);
    }

    const accepted = dispatchWheel(getByTestId("neutral-child"), 41);

    expect(readSnapshot().phaseIndex).toBe(1);
    expect(accepted.event.defaultPrevented).toBe(true);
    expect(accepted.result).toBe(false);
  });

  it("does not duplicate navigation across enabled, unmount, and remount lifecycle", () => {
    mount(
      <App inputOptions={{ enabled: false, wheel: true }}>
        <Targets />
      </App>
    );

    dispatchWheel(getByTestId("neutral-child"), 41);
    expect(readSnapshot().phaseIndex).toBe(0);

    rerender(
      <App inputOptions={{ enabled: true, wheel: true }}>
        <Targets />
      </App>
    );
    dispatchWheel(getByTestId("neutral-child"), 41);
    expect(readSnapshot().phaseIndex).toBe(1);

    rerender(
      <App>
        <Targets />
      </App>
    );
    dispatchWheel(getByTestId("neutral-child"), 41);
    expect(readSnapshot().phaseIndex).toBe(1);

    rerender(
      <App inputOptions={{ enabled: true, wheel: true }}>
        <Targets />
      </App>
    );
    dispatchWheel(getByTestId("neutral-child"), 41);
    expect(readSnapshot().phaseIndex).toBe(2);
  });

  it("keeps native flow controls keyboard-operable without mounting the keyboard hook", async () => {
    mount(
      <App>
        <FlowControls />
      </App>
    );

    const keyboard = userEvent.setup();
    const next = getByTestId("flow-next");
    next.focus();

    await pressKey(keyboard, "{Enter}");

    expect(readSnapshot().phaseIndex).toBe(1);
    expect(getByTestId("flow-next-clicks").textContent).toBe("1");
    expect(document.activeElement).toBe(next);
  });

  it("preserves native button, anchor, and checkbox activation with provider-backed keyboard input", async () => {
    mount(
      <App inputOptions={{ keyboard: true, wheel: false }}>
        <KeyboardTargets />
      </App>
    );

    const keyboard = userEvent.setup();
    const keydowns: KeyboardEvent[] = [];
    const recordKeydown = (event: KeyboardEvent): void => {
      keydowns.push(event);
    };
    window.addEventListener("keydown", recordKeydown);

    const button = getByTestId("native-button");
    button.focus();
    await pressKey(keyboard, " ");
    expect(getByTestId("button-clicks").textContent).toBe("1");
    expect(readSnapshot().phaseIndex).toBe(0);
    expect(keydowns.at(-1)?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(button);

    await pressKey(keyboard, "{Enter}");
    expect(getByTestId("button-clicks").textContent).toBe("2");
    expect(readSnapshot().phaseIndex).toBe(0);
    expect(keydowns.at(-1)?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(button);

    const anchor = getByTestId("native-anchor");
    anchor.focus();
    await pressKey(keyboard, "{Enter}");
    expect(getByTestId("anchor-clicks").textContent).toBe("1");
    expect(readSnapshot().phaseIndex).toBe(0);
    expect(keydowns.at(-1)?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(anchor);

    const checkbox = getByTestId("native-checkbox") as HTMLInputElement;
    checkbox.focus();
    await pressKey(keyboard, " ");
    expect(checkbox.checked).toBe(true);
    expect(readSnapshot().phaseIndex).toBe(0);
    expect(keydowns.at(-1)?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(checkbox);

    window.removeEventListener("keydown", recordKeydown);
  });

  it("preserves focused editable targets under the default ignoreWhenTyping behavior", async () => {
    mount(
      <App inputOptions={{ keyboard: true, wheel: false }}>
        <KeyboardTargets />
      </App>
    );

    const keyboard = userEvent.setup();
    const keydowns: KeyboardEvent[] = [];
    const recordKeydown = (event: KeyboardEvent): void => {
      keydowns.push(event);
    };
    window.addEventListener("keydown", recordKeydown);

    const input = getByTestId("text-input") as HTMLInputElement;
    input.focus();
    await pressKey(keyboard, "abc");
    await pressKey(keyboard, "{ArrowDown}");
    expect(input.value).toBe("abc");
    expect(readSnapshot().phaseIndex).toBe(0);
    expect(keydowns.at(-1)?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);

    const editable = getByTestId("keyboard-editable");
    editable.textContent = "";
    editable.focus();
    await pressKey(keyboard, "xyz");
    await pressKey(keyboard, "{ArrowDown}");
    expect(editable.textContent).toContain("xyz");
    expect(readSnapshot().phaseIndex).toBe(0);
    expect(keydowns.at(-1)?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(editable);

    window.removeEventListener("keydown", recordKeydown);
  });

  it("records accepted, rejected, configured-prevention, and focus behavior for real keyboard shortcuts", async () => {
    mount(
      <App inputOptions={{ keyboard: true, wheel: false }}>
        <KeyboardTargets />
      </App>
    );

    const keyboard = userEvent.setup();
    const keydowns: KeyboardEvent[] = [];
    const recordKeydown = (event: KeyboardEvent): void => {
      keydowns.push(event);
    };
    window.addEventListener("keydown", recordKeydown);

    const neutral = getByTestId("neutral-focus");
    neutral.focus();
    await pressKey(keyboard, "{ArrowUp}");
    expect(readSnapshot().phaseIndex).toBe(0);
    expect(keydowns.at(-1)?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(neutral);

    await pressKey(keyboard, "{ArrowDown}");
    expect(readSnapshot().phaseIndex).toBe(1);
    expect(keydowns.at(-1)?.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(neutral);

    window.removeEventListener("keydown", recordKeydown);

    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;

    mount(
      <App inputOptions={{ keyboard: true, keyboardPreventDefault: false, wheel: false }}>
        <KeyboardTargets />
      </App>
    );

    const noPreventKeydowns: KeyboardEvent[] = [];
    const recordNoPreventKeydown = (event: KeyboardEvent): void => {
      noPreventKeydowns.push(event);
    };
    window.addEventListener("keydown", recordNoPreventKeydown);

    const noPreventNeutral = getByTestId("neutral-focus");
    noPreventNeutral.focus();
    await pressKey(keyboard, "{ArrowDown}");
    expect(readSnapshot().phaseIndex).toBe(1);
    expect(noPreventKeydowns.at(-1)?.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(noPreventNeutral);

    window.removeEventListener("keydown", recordNoPreventKeydown);
  });

  it("accepts one provider-backed repeated key sequence and preserves nested keyboard ancestry", async () => {
    mount(
      <App inputOptions={{ keyboard: true, wheel: false }}>
        <KeyboardTargets />
      </App>
    );

    const keyboard = userEvent.setup();
    const keydowns: KeyboardEvent[] = [];
    const recordKeydown = (event: KeyboardEvent): void => {
      keydowns.push(event);
    };
    window.addEventListener("keydown", recordKeydown);

    const neutral = getByTestId("neutral-focus");
    neutral.focus();
    await pressKey(keyboard, "{ArrowDown>3/}");
    expect(readSnapshot().phaseIndex).toBe(1);
    expect(keydowns.some((event) => event.repeat)).toBe(true);
    expect(document.activeElement).toBe(neutral);

    const nestedButtonEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true
    });
    act(() => {
      getByTestId("native-button-child").dispatchEvent(nestedButtonEvent);
    });
    expect(readSnapshot().phaseIndex).toBe(1);
    expect(nestedButtonEvent.defaultPrevented).toBe(false);

    const nestedAnchorEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true
    });
    act(() => {
      getByTestId("native-anchor-child").dispatchEvent(nestedAnchorEvent);
    });
    expect(readSnapshot().phaseIndex).toBe(1);
    expect(nestedAnchorEvent.defaultPrevented).toBe(false);

    const nestedEditableEvent = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true
    });
    act(() => {
      getByTestId("keyboard-editable-child").dispatchEvent(nestedEditableEvent);
    });
    expect(readSnapshot().phaseIndex).toBe(1);
    expect(nestedEditableEvent.defaultPrevented).toBe(false);

    await pressKey(keyboard, "{ArrowDown}");
    expect(readSnapshot().phaseIndex).toBe(2);

    window.removeEventListener("keydown", recordKeydown);
  });
});
