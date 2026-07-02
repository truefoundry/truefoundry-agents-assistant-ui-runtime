import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { IconButton } from "./primitives/IconButton.js";

export type CodeBlockHeaderProps = {
    language: string;
    code: string;
};

export function CodeBlockHeader({ language, code }: CodeBlockHeaderProps) {
    const [isCopied, setIsCopied] = useState(false);

    const onCopy = () => {
        if (!code || isCopied || typeof navigator === "undefined" || !navigator.clipboard) {
            return;
        }
        navigator.clipboard.writeText(code).then(
            () => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 3000);
            },
            () => {},
        );
    };

    return (
        <div className="aui-code-header-root border-border/50 bg-muted/50 mt-3 flex items-center justify-between rounded-t-xl border border-b-0 px-3.5 py-1.5 text-xs">
            <span className="aui-code-header-language text-muted-foreground font-medium lowercase">
                {language}
            </span>
            <IconButton tooltip="Copy" onClick={onCopy}>
                {!isCopied && <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />}
                {isCopied && <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />}
            </IconButton>
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        CodeBlockHeader: typeof CodeBlockHeader;
    }
}
