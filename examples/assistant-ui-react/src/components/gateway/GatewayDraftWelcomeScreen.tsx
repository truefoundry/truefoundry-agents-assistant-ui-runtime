"use client";

import { GatewaySuggestionCards } from "@/components/gateway/GatewaySuggestionCards";
import { cn } from "@/lib/utils";

export function GatewayDraftWelcomeScreen({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "aui-thread-welcome-root mb-6 flex w-full flex-col items-center gap-6 px-4 text-center",
                className,
            )}
        >
            <div className="flex flex-col items-center gap-2">
                <h1 className="text-2xl font-medium leading-[1.35] text-foreground">
                    How can I help you today?
                </h1>
                <p className="max-w-xl text-xs leading-4 tracking-wide text-muted-foreground">
                    Pick a model, attach connectors and skills, then start your session.
                    You&apos;re in full control here.
                </p>
            </div>
            <GatewaySuggestionCards />
        </div>
    );
}
