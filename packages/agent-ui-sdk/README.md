# @truefoundry/agent-ui-sdk

A design-system-agnostic chat UI SDK for TrueFoundry agents, built on top of
[`@assistant-ui/react`](https://www.assistant-ui.com/) and
[`truefoundry-agents-assistant-ui-runtime`](../truefoundry-agents-assistant-ui-runtime).

```
truefoundry-gateway-sdk (AgentSessionClient)
  → truefoundry-agents-assistant-ui-runtime (useTrueFoundryAgentRuntime)
    → @assistant-ui/react (primitives, ExternalStoreRuntime)
      → THIS SDK
```

It exists to separate **presentation** from **state**, so the visual design
can be replaced later without touching any data-fetching or runtime-wiring
logic.

## Install

```bash
pnpm add @truefoundry/agent-ui-sdk @assistant-ui/react truefoundry-agents-assistant-ui-runtime truefoundry-gateway-sdk react react-dom
```

All four peers must resolve to a **single instance** across your app (see
[Common pitfall](#common-pitfall-duplicate-package-instances) below) — this is
the most likely source of a "requires an AuiProvider" error.

## Quick start

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useTrueFoundryAgentRuntime } from "truefoundry-agents-assistant-ui-runtime";
import { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import { Thread, ThreadListContainer, ErrorToasterProvider, TooltipProvider } from "@truefoundry/agent-ui-sdk";

const client = new AgentSessionClient({
  apiKey: process.env.TFY_API_KEY!,
  environment: process.env.TFY_GATEWAY_URL!,
});

function App() {
  const runtime = useTrueFoundryAgentRuntime({ client, agentName: "my-agent" });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ErrorToasterProvider>
        <TooltipProvider>
          <main style={{ display: "flex", height: "100dvh" }}>
            <aside style={{ width: 256 }}>
              <ThreadListContainer />
            </aside>
            <div style={{ flex: 1 }}>
              <Thread />
            </div>
          </main>
        </TooltipProvider>
      </ErrorToasterProvider>
    </AssistantRuntimeProvider>
  );
}
```

`<Thread />` is the fully-assembled message list + composer. If you need finer
control (e.g. a custom layout around the composer), compose
`<ThreadContainer composer={<ComposerContainer />} />` yourself instead — see
[`src/containers/Thread.tsx`](./src/containers/Thread.tsx).

### Try it locally

The monorepo ships a working demo at `examples/assistant-ui-react`, already
wired against this package:

```bash
pnpm install
cd examples/assistant-ui-react
npm run dev
```

Open `http://localhost:3000` and paste a `.env`-style block when prompted:

```
TFY_API_KEY=your-api-key
TFY_GATEWAY_URL=https://gateway.truefoundry.ai/<your-tenant>
TFY_AGENT_NAME=your-agent-name
```

## Examples

### Dive in (60 seconds)

Every atom is resolved through `useSlot`, so overriding one is just a prop on
`<SlotsProvider>`. `WelcomeScreen` is the fastest thing to see change — it
renders immediately for a new/empty thread:

```tsx
import { SlotsProvider, Thread } from "@truefoundry/agent-ui-sdk";

function MyWelcome({ heading }: { heading?: string }) {
  return <p className="px-4 py-6 text-center text-lg">{heading ?? "Hey 👋 what are we building today?"}</p>;
}

<SlotsProvider overrides={{ WelcomeScreen: MyWelcome }}>
  <Thread />
</SlotsProvider>;
```

Nothing else changes — every other atom (message bubbles, composer, tool
cards) keeps rendering the SDK's defaults. That's the whole pattern; the rest
of this section is that same pattern applied to harder problems.

### Good to know before you start swapping

Not every name declared on `AtomSlots` is actually resolved via `useSlot` by
this SDK's own atoms today. Feature-level atoms (`MessageBubble`,
`ComposerShell`, `ToolCallCard`, `WelcomeScreen`, `ThreadListRow`, `Toast`,
etc.) are — containers call `useSlot(...)` for every one of them, so
overriding them works exactly as documented above. Shared low-level
primitives (`Button`, `IconButton`, `Tooltip*`, `Dialog*`, `Avatar*`,
`Collapsible*`, `Skeleton`, `CodeBlockHeader`) are declared in `AtomSlots` and
have entries in `defaultSlots`, but the atoms that render them
(`AskUserPrompt`, `ToolApprovalBar`, `AttachmentPreviewDialog`,
`AttachmentCard`, `ToolCallCard`, `Markdown`, ComposerShell's own send/attach
buttons, ...) currently `import` them directly instead of going through
`useSlot`. Overriding just `Button` or `Tooltip`, for example, will **not**
change the Submit button inside `AskUserPrompt` or the tooltip on the send
button — those imports bypass the slot registry.

If you need to change one of those primitives everywhere it's used, override
the higher-level atom that embeds it instead (examples 4 and 6 below do
exactly this for `ToolCallCard` and `ComposerShell`). If you hit this and want
it fixed at the source, that's a good signal to file/pick up an issue against
this package rather than fight it from outside.

### Plug-and-play: swapping the design

**1. Restyle the chat bubbles.** `MessageBubble` is a discriminated union on
`variant`, so you can give user and assistant messages completely different
shells while still receiving the same slots (`children`, `error`,
`branchIndicator`, `actionBar`/`attachments`) the default implementation gets:

```tsx
import { SlotsProvider, Thread, type MessageBubbleProps } from "@truefoundry/agent-ui-sdk";

function BubbleV2(props: MessageBubbleProps) {
  if (props.variant === "user") {
    return (
      <div className="ml-auto max-w-[75%] rounded-2xl bg-indigo-600 px-4 py-2 text-white">
        {props.children}
      </div>
    );
  }
  return (
    <div className="mr-auto max-w-[75%] rounded-2xl bg-neutral-100 px-4 py-2 dark:bg-neutral-800">
      {props.children}
      {props.error}
      <div className="mt-1 flex gap-1 text-xs text-neutral-500">
        {props.branchIndicator}
        {props.actionBar}
      </div>
    </div>
  );
}

<SlotsProvider overrides={{ MessageBubble: BubbleV2 }}>
  <Thread />
</SlotsProvider>;
```

**2. Give one part of your app a different look.** `SlotsProvider`s nest and
each `useSlot` call falls back to whatever the nearest ancestor provides — so
an embedded widget can look different from the full-page app without a
second theming system, and without the widget's overrides leaking out:

```tsx
import { SlotsProvider, Thread } from "@truefoundry/agent-ui-sdk";

function CompactWelcome({ heading }: { heading?: string }) {
  return <p className="px-4 py-2 text-sm text-muted-foreground">{heading ?? "Ask me anything"}</p>;
}

// Only this subtree sees CompactWelcome. A <Thread /> rendered anywhere
// outside this component keeps the SDK's default WelcomeScreen.
function EmbeddedWidget() {
  return (
    <SlotsProvider overrides={{ WelcomeScreen: CompactWelcome }}>
      <Thread />
    </SlotsProvider>
  );
}
```

**3. Decorate instead of replace.** An override doesn't have to reimplement
an atom — it can just wrap the default and add behavior, which is the
cheapest way to bolt on analytics/flags without owning any markup:

```tsx
import { forwardRef } from "react";
import {
  SlotsProvider,
  Thread,
  ScrollToBottomButton as DefaultScrollButton,
  type ScrollToBottomButtonProps,
} from "@truefoundry/agent-ui-sdk";

const TrackedScrollButton = forwardRef<HTMLButtonElement, ScrollToBottomButtonProps>((props, ref) => (
  <DefaultScrollButton
    {...props}
    ref={ref}
    onClick={(event) => {
      analytics.track("scroll_to_bottom_clicked");
      props.onClick?.(event);
    }}
  />
));

<SlotsProvider overrides={{ ScrollToBottomButton: TrackedScrollButton }}>
  <Thread />
</SlotsProvider>;
```

**4. Give specific tools their own visual treatment.** `ToolCallCard` gets
`name`/`variant`/`status` on every call, so you can special-case one tool and
fall through to the default `ToolCallCard` (also exported) for everything
else — sub-agents, mcp-listings, and every other tool name:

```tsx
import { SlotsProvider, Thread, ToolCallCard as DefaultToolCallCard, type ToolCallCardProps } from "@truefoundry/agent-ui-sdk";
import { SearchIcon } from "lucide-react";

function CustomToolCallCard(props: ToolCallCardProps) {
  if (props.variant === "tool" && props.name === "web_search") {
    return (
      <div className={props.isError ? "rounded-lg border border-destructive/40 p-2" : "rounded-lg border p-2"}>
        <button onClick={props.onToggle} className="flex items-center gap-2 text-sm">
          <SearchIcon className="size-4" />
          Searching the web{props.durationText ? ` · ${props.durationText}` : ""}
        </button>
        {props.expanded && props.result && <pre className="mt-2 text-xs whitespace-pre-wrap">{props.result}</pre>}
      </div>
    );
  }
  return <DefaultToolCallCard {...props} />;
}

<SlotsProvider overrides={{ ToolCallCard: CustomToolCallCard }}>
  <Thread />
</SlotsProvider>;
```

### Manipulating behavior, not just looks

**5. Turn ask-user into instant click-to-answer.** This is the one gap
explicitly called out below ("select-then-submit, not click-to-answer") and
it can't be closed with a pure atom override: the shipped `AskUserContainer`
computes `onSubmit` from React state set by a *previous* `onSelectOption`
call, so calling both in the same click handler submits stale (empty) state.
Slots only cover atoms, not containers — so the fix is to skip
`AskUserContainer` and talk to the runtime hook it wraps directly:

```tsx
import { useTrueFoundryToolResponses } from "truefoundry-agents-assistant-ui-runtime";
import { useThreadIsRunning } from "@assistant-ui/core/react";

function InstantAskUser() {
  const { pending, respond } = useTrueFoundryToolResponses();
  const isRunning = useThreadIsRunning();
  const item = pending[0];
  if (item == null) return null;

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border p-3">
      <p className="w-full text-sm font-medium">{item.question ?? "Answer required"}</p>
      {(item.options ?? []).map((label) => (
        <button
          key={label}
          disabled={isRunning}
          onClick={() => respond({ toolCallId: item.toolCallId, content: label })}
          className="rounded-full border px-3 py-1 text-sm"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

Wire it in by writing your own thin composer wrapper that renders
`<InstantAskUser />` in place of `<AskUserContainer />` — mirror the
branching in [`ComposerContainer`](./src/containers/ComposerContainer.tsx)
(it's ~15 lines: check `mcpPending`, then `toolResponsesPending`, then fall
through to `<ComposerShell />`) and pass your wrapper to
`<ThreadContainer composer={<YourComposer />} />` instead of using `<Thread />`.

**6. Add an affordance the shipped atoms don't have.** `ComposerShell` has no
stop/cancel button (see Known gaps). `ComposerShell`'s own prop contract has
no `isRunning`/`onCancel` either — but since your override is your own
component, not one of this package's internal atoms, it's free to reach for
assistant-ui's own `ComposerPrimitive.Cancel` (a peer dep you already depend
on) instead of waiting for the contract to grow one:

```tsx
import { SlotsProvider, Thread, IconButton, type ComposerShellProps } from "@truefoundry/agent-ui-sdk";
import { ComposerPrimitive } from "@assistant-ui/react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";

function ComposerWithStop({ value, placeholder, disabled, onValueChange, onSubmit }: ComposerShellProps) {
  return (
    <div className="border-border/60 flex w-full flex-col gap-2 rounded-3xl border p-2">
      <textarea
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        className="w-full resize-none bg-transparent px-2 py-1 outline-none"
      />
      <div className="flex justify-end gap-2 px-1">
        {/* Renders disabled (no-op) when there's nothing to cancel, so it's
            always safe to mount. */}
        <ComposerPrimitive.Cancel asChild>
          <IconButton tooltip="Stop generating">
            <SquareIcon />
          </IconButton>
        </ComposerPrimitive.Cancel>
        <IconButton tooltip="Send" onClick={onSubmit} disabled={disabled || value.trim().length === 0}>
          <ArrowUpIcon />
        </IconButton>
      </div>
    </div>
  );
}

<SlotsProvider overrides={{ ComposerShell: ComposerWithStop }}>
  <Thread />
</SlotsProvider>;
```

**7. Redirect a cross-cutting behavior.** `ErrorToasterProvider` resolves
`Toast`/`ToastStack` via `useSlot`, so you can reroute every gateway/runtime
error it raises through a different toast library (e.g. `sonner`) without
touching `useErrorToaster` or any call site of `showError`:

```tsx
import { useEffect } from "react";
import {
  SlotsProvider,
  ErrorToasterProvider,
  Thread,
  type ToastProps,
  type ToastStackProps,
} from "@truefoundry/agent-ui-sdk";
import { Toaster, toast as sonnerToast } from "sonner";

function SonnerToast({ title, description, open, onOpenChange }: ToastProps) {
  useEffect(() => {
    if (!open) return;
    sonnerToast.error(title, { description });
    onOpenChange(false); // sonner now owns the visible toast
  }, [open, title, description, onOpenChange]);
  return null;
}

function SonnerToastStack({ children }: ToastStackProps) {
  return (
    <>
      {children}
      <Toaster richColors />
    </>
  );
}

// SlotsProvider must be an ancestor of ErrorToasterProvider -- ErrorToasterProvider
// resolves the slot at its own position in the tree, so overrides below it won't apply.
<SlotsProvider overrides={{ Toast: SonnerToast, ToastStack: SonnerToastStack }}>
  <ErrorToasterProvider>
    <Thread />
  </ErrorToasterProvider>
</SlotsProvider>;
```

**8. Layer local-only UI onto a row without touching the container.**
`ThreadListRow`'s contract (`title`/`active`/`onSelect`/`onArchive`/
`onDelete`) has no concept of "pinned" — nothing needs to. An override is
just a component, so it can hold state the container never sees:

```tsx
import { useState } from "react";
import {
  SlotsProvider,
  ThreadListContainer,
  ThreadListRow as DefaultRow,
  type ThreadListRowProps,
} from "@truefoundry/agent-ui-sdk";
import { PinIcon } from "lucide-react";

function PinnableRow(props: ThreadListRowProps) {
  const [pinned, setPinned] = useState(false);
  return (
    <div className="relative">
      <DefaultRow {...props} />
      <button
        onClick={(event) => {
          event.stopPropagation();
          setPinned((prev) => !prev);
        }}
        className="absolute left-1.5 top-1/2 -translate-y-1/2"
      >
        <PinIcon className={pinned ? "size-3.5 fill-current" : "size-3.5"} />
      </button>
    </div>
  );
}

<SlotsProvider overrides={{ ThreadListRow: PinnableRow }}>
  <ThreadListContainer />
</SlotsProvider>;
```

## Architecture

Every piece of UI is split into two layers:

### Atoms (`src/atoms/**`)

Pure, stateless, prop-driven components. An atom:

- Never imports from `@assistant-ui/*` or `truefoundry-agents-assistant-ui-runtime`.
- Never calls a runtime/data hook — only local `useState`/`useMemo`/`useCallback`
  for purely visual concerns (e.g. a confirm-dialog's open state).
- Owns **all** Tailwind classes and JSX styling for what it renders.
- Only knows "render this data, call this callback."

This is the swap point: replacing the whole design system later means writing
new components that satisfy the same prop contracts — zero changes to any
container.

### Containers (`src/containers/**`)

Stateful glue. A container:

- Reads assistant-ui primitives/hooks (`ThreadPrimitive`, `MessagePrimitive`,
  `useAuiState`, `useAui`, `@assistant-ui/core/react`'s `useMessageBranching` /
  `useActionBarCopy` / `useThreadIsRunning` / etc.) and TrueFoundry runtime
  hooks (`useTrueFoundryApprovals`, `useTrueFoundryToolResponses`,
  `useTrueFoundryMcpAuth`, `useTrueFoundryRespondToToolApproval`).
- Derives plain data and callbacks from that state.
- Resolves every atom via `useSlot("AtomName")` — **never** imports an atom
  directly — and passes the derived props straight through.
- Contains no Tailwind classes / inline styles of its own (a couple of `hidden`
  HTML attributes and bare wrapper `<div>`s are the only exceptions, since
  those aren't decorative styling).

### The slot registry (`src/theme/SlotsProvider.tsx`)

`AtomSlots` is an interface that starts empty and gets augmented by every atom
module via `declare module "../theme/SlotsProvider.js"` — so adding an atom
never requires editing the registry itself. `defaultSlots.ts` supplies this
SDK's own implementation for every slot.

To swap in a different design system, wrap any subtree in `<SlotsProvider>`
with just the overrides you want — everything else keeps using the default:

```tsx
import { SlotsProvider, Thread } from "@truefoundry/agent-ui-sdk";
import { MyBubble } from "./my-design-system/MessageBubble";

<SlotsProvider overrides={{ MessageBubble: MyBubble }}>
  <Thread />
</SlotsProvider>;
```

`useSlot` falls back through nested `<SlotsProvider>`s to the default, so you
only ever need to override what actually changes. See [Examples](#examples)
above for eight more worked cases, including the caveat on which slot names
are actually resolved via `useSlot` today versus merely declared.

### Token contract (`src/theme/tokens.ts`)

`DesignTokens` is a semantic color/radius/spacing/typography contract exposed
via `useTokens()`/`<TokensProvider>`. The shipped default atoms don't consume
it yet (they port the reference app's Tailwind classes verbatim); it exists so
a future design system has a token surface to bind to without inventing one.

## What's in the box

| Area | Containers | Notes |
|---|---|---|
| Thread shell | `ThreadContainer`, `Thread` | Welcome screen, loading skeleton, scroll-to-bottom, message list |
| Messages | `AssistantMessageContainer`, `UserMessageContainer`, `AssistantTextContainer` | Text, branch picker, error banner, copy/export action bar |
| Tools | `ToolCallContainer`, `ToolGroupContainer` | Tool-call rendering, approval flow, sub-agent nesting (recursive) |
| Reasoning | `ReasoningContainer` | Streaming-aware collapsible reasoning blocks |
| Composer | `ComposerContainer`, `AskUserContainer`, `McpAuthContainer` | Message input; auto-swaps to ask-user / MCP-auth prompts when a turn is paused |
| Attachments | `ComposerAttachmentsContainer`, `ComposerAttachmentPickerContainer` | Composer-side staging tray only — see gaps below |
| Thread list | `ThreadListContainer` | Flat list (not grouped by date), new/select/archive/delete |
| Errors | `ErrorToasterProvider`, `useErrorToaster` | Global toast for gateway/runtime errors |

Every atom's prop type is exported from [`src/index.ts`](./src/index.ts) —
that file is the definitive list of what's public.

## Known gaps / deviations from the reference app

These were flagged deliberately during implementation rather than silently
dropped:

- **`ToolCallCard`** ships a `mcp-listing` variant (type + atom) that no
  container currently selects — there's no signal in the runtime today that
  distinguishes "listing MCP tools" from any other tool call.
- **`ToolCallCard`**'s `tool` variant has an `approvalSlot`/`durationText`
  beyond the originally-sketched contract — needed to keep the (fully
  supported) tool-approval flow working.
- **`ComposerShell`** has no cancel/stop-generating affordance and no visible
  attachment tray. Streaming can't be cancelled through it, and staged
  attachments aren't shown (though they're still sent). Use
  `ComposerAttachmentsContainer` / `ComposerAttachmentPickerContainer`
  directly if you need those visible.
- **`AskUserPrompt`** uses a select-then-submit radio flow, not the reference
  app's immediate-click-to-answer buttons.
- **`ThreadListContainer`** renders one flat list, not grouped by
  Today/Yesterday/Earlier.
- Message-bubble attachment rendering is intentionally **not** implemented —
  the runtime's own README documents user-message attachments as "text only,"
  and this SDK preserves that rather than adding new scope.
- Several `AtomSlots` entries (`Button`, `IconButton`, `Tooltip*`, `Dialog*`,
  `Avatar*`, `Collapsible*`, `Skeleton`, `CodeBlockHeader`) are declared and
  populated in `defaultSlots`, but no shipped atom currently resolves them via
  `useSlot` — the atoms that render them import them directly instead. See
  "Good to know before you start swapping" in [Examples](#examples) for what
  to override instead.

## Common pitfall: duplicate package instances

`@assistant-ui/core` (and therefore `@assistant-ui/store`, which holds the
React Context `AuiProvider` relies on) takes `react` as a peer dependency. If
your app and this SDK resolve to two different `react` versions —
even two patch versions apart — pnpm may install two physically separate
copies of `@assistant-ui/core`/`@assistant-ui/store`. Since React Context
identity is tied to the *module instance*, hooks like `useAuiState`/`useAui`
called from inside this SDK will then read from a different Context object
than the one your `<AssistantRuntimeProvider>` provides, producing:

```
Uncaught Error: You are using a component or hook that requires an
AuiProvider. Wrap your component in an <AuiProvider> component.
```

even though a provider **is** mounted. Diagnose with:

```bash
pnpm why @assistant-ui/core -r
pnpm why @assistant-ui/store -r
```

If either reports more than one instance, align every `react`/`react-dom`
version across the workspace (same range, not a mix of pinned-exact and
caret-ranged) and reinstall.

## Development

```bash
pnpm --filter @truefoundry/agent-ui-sdk build       # tsup → dist/
pnpm --filter @truefoundry/agent-ui-sdk typecheck   # tsc --noEmit
pnpm --filter @truefoundry/agent-ui-sdk test        # vitest
```

Tests render containers against a real (in-memory) assistant-ui runtime via
[`src/containers/RuntimeHarness.tsx`](./src/containers/RuntimeHarness.tsx) —
no network calls, no real gateway required.

## A note on the vendored runtime dependency

`truefoundry-agents-assistant-ui-runtime` isn't published to npm yet, so it's
vendored verbatim into this monorepo at `packages/truefoundry-agents-assistant-ui-runtime`
and linked via pnpm's `workspace:*` protocol. See that package's own README
for the pinned commit and the note on when to replace it with a real
dependency.
