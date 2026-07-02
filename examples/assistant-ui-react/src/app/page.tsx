import { Thread, ThreadListContainer as ThreadList } from "@truefoundry/agent-ui-sdk";

export default function Home() {
    return (
        <main className="flex h-dvh overflow-hidden">
            <aside className="border-border flex min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r">
                <ThreadList />
            </aside>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <Thread />
            </div>
        </main>
    );
}
