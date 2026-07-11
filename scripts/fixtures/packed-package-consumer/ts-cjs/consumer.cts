import flow = require("r3f-interactive-flow");
import type {
  FlowFrameCallback,
  FlowFrameState,
  FlowTransitionOptions,
  FlowInputTarget
} from "r3f-interactive-flow";

const provider: typeof flow.FlowProvider = flow.FlowProvider;
const flowHook: typeof flow.useFlow = flow.useFlow;
const progressHook: typeof flow.useFlowProgress = flow.useFlowProgress;
const frameHook: typeof flow.useFlowFrame = flow.useFlowFrame;
const wheelHook: typeof flow.useWheelInput = flow.useWheelInput;
const touchHook: typeof flow.useTouchInput = flow.useTouchInput;
const keyboardHook: typeof flow.useKeyboardInput = flow.useKeyboardInput;

type Phase = "a" | "b";

const frameCallback: FlowFrameCallback<Phase> = (state: FlowFrameState<Phase>, delta: number) => {
  void state.phase;
  void delta;
};

const transitionOptions: FlowTransitionOptions<Phase> = {
  duration: 500,
  byPhase: { a: { duration: 250 } }
};

declare const windowTarget: Window;
const inputTarget: FlowInputTarget = windowTarget;

void provider;
void flowHook;
void progressHook;
void frameHook;
void wheelHook;
void touchHook;
void keyboardHook;
void frameCallback;
void transitionOptions;
void inputTarget;
