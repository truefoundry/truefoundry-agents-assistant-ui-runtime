import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
} from "@assistant-ui/react";

function ThreadListItem() {
  return (
    <ThreadListItemPrimitive.Root className="group flex items-center rounded-lg data-[active=true]:bg-blue-50 dark:data-[active=true]:bg-blue-950/40">
      <ThreadListItemPrimitive.Trigger className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
        <ThreadListItemPrimitive.Title fallback="New chat" />
      </ThreadListItemPrimitive.Trigger>
    </ThreadListItemPrimitive.Root>
  );
}

export function ThreadList() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Conversations
        </h2>
      </div>

      <ThreadListPrimitive.Root className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <ThreadListPrimitive.New className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
          + New chat
        </ThreadListPrimitive.New>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ThreadListPrimitive.Items>{() => <ThreadListItem />}</ThreadListPrimitive.Items>
          <ThreadListPrimitive.LoadMore className="mt-2 w-full rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800">
            Load more
          </ThreadListPrimitive.LoadMore>
        </div>
      </ThreadListPrimitive.Root>
    </aside>
  );
}
