import { useState } from "react";
import {
  useTrueFoundryApprovals,
  useTrueFoundryToolResponses,
  type PendingToolResponse,
} from "@truefoundry/assistant-ui-runtime";

function ToolApprovalPanel() {
  const { pending, respond } = useTrueFoundryApprovals();
  const item = pending[0];

  if (item == null) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        Allow tool call: {item.toolName}?
      </p>
      {item.argsText.trim() !== "" && (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          {item.argsText}
        </pre>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() =>
            respond({ approvalId: item.approvalId, approved: true })
          }
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Allow
        </button>
        <button
          type="button"
          onClick={() =>
            respond({ approvalId: item.approvalId, approved: false })
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-white dark:border-slate-600 dark:hover:bg-slate-900"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function AskUserPanel({ pending }: { pending: PendingToolResponse }) {
  const { respond } = useTrueFoundryToolResponses();
  const [answer, setAnswer] = useState("");

  const submitAnswer = (content: string) => {
    const trimmed = content.trim();
    if (trimmed === "") {
      return;
    }
    respond({ toolCallId: pending.toolCallId, content: trimmed });
    setAnswer("");
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
        {pending.question ?? "The agent needs your input"}
      </p>

      {pending.options != null && pending.options.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {pending.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => submitAnswer(option)}
              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm hover:bg-blue-100 dark:border-blue-800 dark:bg-slate-950 dark:hover:bg-blue-950"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitAnswer(answer);
          }}
        >
          <input
            type="text"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Type your answer..."
            className="min-w-0 flex-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-blue-800 dark:bg-slate-950"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Submit
          </button>
        </form>
      )}
    </div>
  );
}

function ToolResponsePanel() {
  const { pending } = useTrueFoundryToolResponses();
  const item = pending[0];

  if (item == null) {
    return null;
  }

  return <AskUserPanel key={item.toolCallId} pending={item} />;
}

export function InteractionPanels() {
  const { pending: approvals } = useTrueFoundryApprovals();
  const { pending: responses } = useTrueFoundryToolResponses();

  if (approvals.length > 0) {
    return <ToolApprovalPanel />;
  }

  if (responses.length > 0) {
    return <ToolResponsePanel />;
  }

  return null;
}
