import { ExternalLinkIcon } from "lucide-react";

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
        <div data-slot="aui_mcp-auth-continue-composer" className={cn("flex w-full flex-col gap-3", className)}>
            <div className="border-primary/20 bg-background overflow-hidden rounded-2xl border">
                <div className="bg-primary/10 border-primary/20 border-b px-4 py-2.5">
                    <p className="text-primary text-sm font-semibold">MCP Authentication Required</p>
                </div>
                <ul className="divide-border/60 divide-y">
                    {servers.map((server) => (
                        <li
                            key={server.id}
                            className="flex items-center justify-between gap-3 px-4 py-2.5"
                        >
                            <p className="text-sm">
                                <span className="text-muted-foreground">MCP Server Name</span>
                                <span className="text-muted-foreground mx-1.5">:</span>
                                <span className="font-semibold">{server.name}</span>
                            </p>
                            <Button
                                asChild
                                size="sm"
                                className="bg-foreground text-background hover:bg-foreground/80 rounded-full"
                            >
                                <a href={server.authUrl} target="_blank" rel="noopener noreferrer">
                                    Connect
                                    <ExternalLinkIcon className="size-3.5" />
                                </a>
                            </Button>
                        </li>
                    ))}
                </ul>
            </div>
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
