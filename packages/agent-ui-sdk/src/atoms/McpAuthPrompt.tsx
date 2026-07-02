import { cn } from "./lib/cn.js";
import { Button } from "./primitives/Button.js";

export type McpAuthServer = { id: string; name: string; authUrl: string };

export type McpAuthPromptProps = {
    servers: McpAuthServer[];
    disabled: boolean;
    onContinue: () => void;
    className?: string;
};

export function McpAuthPrompt({ servers, disabled, onContinue, className }: McpAuthPromptProps) {
    return (
        <div
            data-slot="aui_mcp-auth-continue-composer"
            className={cn(
                "border-border/60 flex w-full flex-col gap-3 rounded-(--composer-radius,1.5rem) border bg-(--composer-bg,var(--muted)) p-(--composer-padding,8px)",
                className,
            )}
        >
            <p className="text-muted-foreground px-2.5 text-sm">
                Complete authorization above, then continue the agent.
                {servers.length > 0 && ` (${servers.map((s) => s.name).join(", ")})`}
            </p>
            <div className="flex justify-end px-2.5">
                <Button type="button" className="rounded-full px-4" disabled={disabled} onClick={onContinue}>
                    Continue
                </Button>
            </div>
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        McpAuthPrompt: typeof McpAuthPrompt;
    }
}
