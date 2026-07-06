import { useState } from "react";
import { DownloadIcon, FileIcon, LoaderIcon } from "lucide-react";

import { cn } from "./lib/cn.js";

export type SandboxArtifactLink = { label: string; path: string };

export type SandboxArtifactListProps = {
    artifacts: SandboxArtifactLink[];
    onDownload?: (path: string) => void | Promise<unknown>;
    className?: string;
};

export function SandboxArtifactList({ artifacts, onDownload, className }: SandboxArtifactListProps) {
    const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

    const handleClick = async (path: string) => {
        if (downloadingPath != null) return;
        setDownloadingPath(path);
        try {
            await onDownload?.(path);
        } finally {
            setDownloadingPath(null);
        }
    };

    return (
        <div
            data-slot="aui_sandbox-artifact-list"
            className={cn("aui-sandbox-artifact-list my-3 flex w-fit max-w-full flex-wrap items-stretch text-sm", className)}
        >
            {artifacts.map((artifact, index) => {
                const isDownloading = downloadingPath === artifact.path;
                return (
                    <button
                        key={artifact.path}
                        type="button"
                        className={cn(
                            "aui-sandbox-artifact-button text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1.5 py-1 pr-2 pl-2 transition-colors disabled:pointer-events-none disabled:opacity-70",
                            index > 0 && "border-border/60 ml-1 border-l pl-3",
                        )}
                        disabled={isDownloading}
                        onClick={() => handleClick(artifact.path)}
                    >
                        <FileIcon className="size-4 shrink-0" aria-hidden />
                        <span className="max-w-40 truncate">{artifact.label}</span>
                        {isDownloading ? (
                            <LoaderIcon className="size-3.5 shrink-0 animate-spin [animation-duration:0.6s]" aria-hidden />
                        ) : (
                            <DownloadIcon className="size-3.5 shrink-0" aria-hidden />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        SandboxArtifactList: typeof SandboxArtifactList;
    }
}
