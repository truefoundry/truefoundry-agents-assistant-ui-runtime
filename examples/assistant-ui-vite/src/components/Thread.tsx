import {
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type ReasoningMessagePartComponent,
  type TextMessagePartComponent,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";

import { InteractionPanels } from "./InteractionPanels";
import { ToolCallPart } from "./ToolCallPart";

const UserTextPart: TextMessagePartComponent = ({ text }) => (
  <p className="whitespace-pre-wrap">{text}</p>
);

const AssistantTextPart: TextMessagePartComponent = () => (
  <MarkdownTextPrimitive
    remarkPlugins={[remarkGfm]}
    className="prose prose-sm max-w-none dark:prose-invert"
  />
);

const ReasoningPart: ReasoningMessagePartComponent = ({ text }) => (
  <details className="mb-2 rounded border border-slate-200 p-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
    <summary className="cursor-pointer font-medium">Reasoning</summary>
    <p className="mt-2 whitespace-pre-wrap">{text}</p>
  </details>
);

function UserMessage() {
  return (
    <MessagePrimitive.Root className="mb-4 flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2 text-sm text-white">
        <MessagePrimitive.Parts
          components={{
            Text: UserTextPart,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="mb-4">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        <MessagePrimitive.Parts
          components={{
            Text: AssistantTextPart,
            Reasoning: ReasoningPart,
            tools: {
              Fallback: ToolCallPart,
            },
          }}
        />
        <ErrorPrimitive.Root>
          <ErrorPrimitive.Message className="mt-2 text-sm text-red-600 dark:text-red-400" />
        </ErrorPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <ComposerPrimitive.Input
        placeholder="Send a message..."
        className="min-h-[44px] w-full resize-none bg-transparent text-sm outline-none"
        rows={1}
        autoFocus
      />
      <div className="mt-2 flex justify-end gap-2">
        <AuiIf condition={(state) => state.thread.isRunning}>
          <ComposerPrimitive.Cancel className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
            Stop
          </ComposerPrimitive.Cancel>
        </AuiIf>
        <AuiIf condition={(state) => !state.thread.isRunning}>
          <ComposerPrimitive.Send className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            Send
          </ComposerPrimitive.Send>
        </AuiIf>
      </div>
    </ComposerPrimitive.Root>
  );
}

export function Thread() {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <AuiIf condition={(state) => state.thread.isEmpty}>
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Start a conversation
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Ask your TrueFoundry agent anything. Tool approvals and ask-user
              prompts appear above the composer.
            </p>
          </div>
        </AuiIf>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 space-y-3 bg-slate-50 pt-4 dark:bg-slate-950">
          <ThreadPrimitive.ScrollToBottom className="mx-auto block rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-white disabled:hidden dark:border-slate-600 dark:hover:bg-slate-900">
            Scroll to bottom
          </ThreadPrimitive.ScrollToBottom>
          <InteractionPanels />
          <Composer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
