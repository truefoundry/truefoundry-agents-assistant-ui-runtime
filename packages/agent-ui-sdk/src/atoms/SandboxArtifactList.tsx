import { DownloadIcon } from "lucide-react";

import { cn } from "./lib/cn.js";
import { Button } from "./primitives/Button.js";

export type SandboxArtifactLink = { label: string; path: string };

export type SandboxArtifactListProps = {
    artifacts: SandboxArtifactLink[];
    onDownload?: (path: string) => void;
    className?: string;
};

export function SandboxArtifactList({ artifacts, onDownload, className }: SandboxArtifactListProps) {
    return (
        <div
            data-slot="aui_sandbox-artifact-list"
            className={cn("aui-sandbox-artifact-list my-3 flex flex-col gap-1.5", className)}
        >
            {artifacts.map((artifact) => (
                <Button
                    key={artifact.path}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="aui-sandbox-artifact-button justify-start"
                    onClick={() => onDownload?.(artifact.path)}
                >
                    <DownloadIcon aria-hidden />
                    {artifact.label}
                </Button>
            ))}
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        SandboxArtifactList: typeof SandboxArtifactList;
    }
}
