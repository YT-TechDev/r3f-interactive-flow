import { FlowClient } from "./flow-client";
import { PHASES } from "./flow-contract";

export default function Page() {
  return <FlowClient phases={PHASES} title="Next.js App Router packed consumer" />;
}
