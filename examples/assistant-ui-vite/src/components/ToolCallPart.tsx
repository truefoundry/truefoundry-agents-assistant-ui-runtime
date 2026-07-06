import type { ToolCallMessagePartComponent } from "@assistant-ui/react";

export const ToolCallPart: ToolCallMessagePartComponent = (part) => {
  const isPendingApproval =
    part.approval != null && part.approval.approved === undefined;
  const isPendingInput = part.interrupt != null;
  const hasResult = part.result !== undefined;

  return (
    <div className="my-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
        <span className="text-slate-500">Tool</span>
        <span>{part.toolName}</span>
        {isPendingApproval && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            awaiting approval
          </span>
        )}
        {isPendingInput && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            awaiting input
          </span>
        )}
        {hasResult && !part.isError && (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            done
          </span>
        )}
        {hasResult && part.isError && (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
            error
          </span>
        )}
      </div>

      {part.argsText.trim() !== "" && (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          {part.argsText}
        </pre>
      )}

      {hasResult && (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          {typeof part.result === "string"
            ? part.result
            : JSON.stringify(part.result, null, 2)}
        </pre>
      )}
    </div>
  );
};
