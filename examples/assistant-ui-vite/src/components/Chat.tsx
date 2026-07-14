import { useState } from "react";
import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  ThreadPrimitive,
  type ToolCallMessagePartComponent,
} from "@assistant-ui/react";
import {
  useTrueFoundryApprovals,
  useTrueFoundryToolResponses,
} from "@truefoundry/assistant-ui-runtime";

const ToolCallPart: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
}) => (
  <details className="my-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
    <summary className="cursor-pointer font-medium text-slate-700">
      {toolName}
    </summary>
    {argsText.trim() !== "" && (
      <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs text-slate-600">
        {argsText}
      </pre>
    )}
    {result !== undefined && (
      <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs text-slate-600">
        {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
      </pre>
    )}
  </details>
);

function InteractionPanels() {
  const { pending: approvals, respond: respondApproval } =
    useTrueFoundryApprovals();
  const { pending: responses, respond: respondResponse } =
    useTrueFoundryToolResponses();
  const [answer, setAnswer] = useState("");

  const approval = approvals[0];
  if (approval != null) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-medium text-amber-900">
          Allow tool call: {approval.toolName}?
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="btn btn-primary bg-emerald-600 hover:bg-emerald-700"
            onClick={() =>
              respondApproval({
                approvalId: approval.approvalId,
                approved: true,
              })
            }
          >
            Allow
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              respondApproval({
                approvalId: approval.approvalId,
                approved: false,
              })
            }
          >
            Deny
          </button>
        </div>
      </div>
    );
  }

  const response = responses[0];
  if (response != null) {
    const submit = (content: string) => {
      const trimmed = content.trim();
      if (trimmed === "") return;
      respondResponse({ toolCallId: response.toolCallId, content: trimmed });
      setAnswer("");
    };

    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="font-medium text-blue-900">
          {response.question ?? "The agent needs your input"}
        </p>
        {response.options != null && response.options.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {response.options.map((option) => (
              <button
                key={option}
                type="button"
                className="btn btn-secondary"
                onClick={() => submit(option)}
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
              submit(answer);
            }}
          >
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Type your answer..."
              className="input min-w-0 flex-1"
            />
            <button type="submit" className="btn btn-primary">
              Submit
            </button>
          </form>
        )}
      </div>
    );
  }

  return null;
}

export function Chat() {
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Chats
          </h2>
        </div>

        <ThreadListPrimitive.Root className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <ThreadListPrimitive.New className="btn btn-secondary w-full border-dashed">
            + New chat
          </ThreadListPrimitive.New>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            <ThreadListPrimitive.Items
              components={{
                ThreadListItem: () => (
                  <ThreadListItemPrimitive.Root className="rounded-lg data-[active=true]:bg-blue-50">
                    <ThreadListItemPrimitive.Trigger className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 data-[active=true]:font-medium data-[active=true]:text-blue-700">
                      <ThreadListItemPrimitive.Title fallback="New chat" />
                    </ThreadListItemPrimitive.Trigger>
                  </ThreadListItemPrimitive.Root>
                ),
              }}
            />
          </div>

          <AuiIf condition={(state) => state.threads.hasMore}>
            <ThreadListPrimitive.LoadMore className="btn btn-ghost w-full text-xs disabled:opacity-50">
              Load more
            </ThreadListPrimitive.LoadMore>
          </AuiIf>
        </ThreadListPrimitive.Root>
      </aside>

      <ThreadPrimitive.Root className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
        <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <ThreadPrimitive.Messages
            components={{
              UserMessage: () => (
                <MessagePrimitive.Root className="mb-4 flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm">
                    <MessagePrimitive.Parts />
                  </div>
                </MessagePrimitive.Root>
              ),
              AssistantMessage: () => (
                <MessagePrimitive.Root className="mb-4">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm">
                    <MessagePrimitive.Parts
                      components={{
                        tools: { Fallback: ToolCallPart },
                      }}
                    />
                  </div>
                </MessagePrimitive.Root>
              ),
            }}
          />
        </ThreadPrimitive.Viewport>

        <ThreadPrimitive.ViewportFooter className="shrink-0 space-y-3 border-t border-slate-200 bg-white p-4">
          <InteractionPanels />
          <ComposerPrimitive.Root className="panel p-3">
            <ComposerPrimitive.Input
              placeholder="Send a message..."
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-slate-400"
              rows={2}
            />
            <div className="mt-2 flex justify-end gap-2">
              <AuiIf condition={(state) => state.thread.isRunning}>
                <ComposerPrimitive.Cancel className="btn btn-secondary">
                  Stop
                </ComposerPrimitive.Cancel>
              </AuiIf>
              <AuiIf condition={(state) => !state.thread.isRunning}>
                <ComposerPrimitive.Send className="btn btn-primary">
                  Send
                </ComposerPrimitive.Send>
              </AuiIf>
            </div>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Root>
    </div>
  );
}
