import {
  FlowProvider,
  useFlow,
  useFlowProgress,
  useFlowFrame,
  useWheelInput,
  useTouchInput,
  useKeyboardInput
} from "r3f-interactive-flow";
import type {
  FlowFrameCallback,
  FlowFrameState,
  FlowTransitionOptions,
  FlowInputTarget
} from "r3f-interactive-flow";

const provider: typeof FlowProvider = FlowProvider;
const flowHook: typeof useFlow = useFlow;
const progressHook: typeof useFlowProgress = useFlowProgress;
const frameHook: typeof useFlowFrame = useFlowFrame;
const wheelHook: typeof useWheelInput = useWheelInput;
const touchHook: typeof useTouchInput = useTouchInput;
const keyboardHook: typeof useKeyboardInput = useKeyboardInput;

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
