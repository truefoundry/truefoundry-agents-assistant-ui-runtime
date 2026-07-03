"use client";

import { useCallback } from "react";
import { useAuiState } from "@assistant-ui/react";
import { useTrueFoundryDownloadSandboxFile } from "truefoundry-agents-assistant-ui-runtime";

import { useSlot } from "../theme/SlotsProvider.js";
import { useErrorToasterOptional } from "./ErrorToasterContainer.js";

function filenameFromPath(path: string): string {
    return path.split("/").pop() || "download";
}

function triggerBrowserDownload(blob: Blob, filename: string) {
    if (typeof document === "undefined") return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function AssistantTextContainer() {
    const Markdown = useSlot("Markdown");
    const downloadSandboxFile = useTrueFoundryDownloadSandboxFile();
    const errorToaster = useErrorToasterOptional();
    const text = useAuiState((s) =>
        s.part.type === "text" || s.part.type === "reasoning" ? s.part.text : "",
    );
    const isStreaming = useAuiState((s) => {
        if (s.message.status?.type !== "running") return false;
        const lastIndex = s.message.parts.length - 1;
        if (lastIndex < 0) return false;
        if (s.part.type !== "text" && s.part.type !== "reasoning") return false;
        return s.message.parts[lastIndex] === s.part;
    });

    const handleDownloadArtifact = useCallback(
        (path: string) => {
            downloadSandboxFile(path)
                .then((blob) => triggerBrowserDownload(blob, filenameFromPath(path)))
                .catch((error) => {
                    if (errorToaster != null) {
                        errorToaster.showError(error);
                    } else {
                        console.error("Failed to download sandbox artifact", error);
                    }
                });
        },
        [downloadSandboxFile, errorToaster],
    );

    return <Markdown content={text} isStreaming={isStreaming} onDownloadArtifact={handleDownloadArtifact} />;
}
