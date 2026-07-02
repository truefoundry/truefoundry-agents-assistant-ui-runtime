import { memo } from "react";
import { Renderer } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";

import { cn } from "./lib/cn.js";

export type OpenUIBlockProps = {
    source: string;
    isStreaming?: boolean;
    className?: string;
};

/** Renders an OpenUI Lang fenced code block (```openui ... ```). */
export const OpenUIBlock = memo(
    function OpenUIBlock({ source, isStreaming, className }: OpenUIBlockProps) {
        return (
            <div
                data-slot="openui-block"
                className={cn("aui-openui-block my-3", className)}
                style={{ contain: "layout paint" }}
            >
                <Renderer
                    response={source}
                    library={openuiLibrary}
                    isStreaming={!!isStreaming}
                />
            </div>
        );
    },
    (prev, next) =>
        prev.source === next.source && !!prev.isStreaming === !!next.isStreaming,
);

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        OpenUIBlock: typeof OpenUIBlock;
    }
}
