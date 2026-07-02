import { memo, useId } from "react";
import { Renderer } from "@openuidev/react-lang";
import { ThemeProvider } from "@openuidev/react-ui";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";

import { useClassDarkMode, type ThemeMode } from "../theme/useClassDarkMode.js";
import { cn } from "./lib/cn.js";

export type OpenUIBlockProps = {
    source: string;
    isStreaming?: boolean;
    className?: string;
    /** Override light/dark mode. Defaults to syncing with a `.dark` class on `<html>`. */
    mode?: ThemeMode;
};

/** Renders an OpenUI Lang fenced code block (```openui ... ```). */
export const OpenUIBlock = memo(
    function OpenUIBlock({ source, isStreaming, className, mode: modeProp }: OpenUIBlockProps) {
        const detectedMode = useClassDarkMode();
        const mode = modeProp ?? detectedMode;
        const scopeClass = `aui-openui-theme-${useId().replace(/:/g, "")}`;

        return (
            <ThemeProvider mode={mode} cssSelector={`.${scopeClass}`}>
                <div
                    data-slot="openui-block"
                    className={cn("aui-openui-block my-3", scopeClass, className)}
                    style={{ contain: "layout paint" }}
                >
                    <Renderer
                        response={source}
                        library={openuiLibrary}
                        isStreaming={!!isStreaming}
                    />
                </div>
            </ThemeProvider>
        );
    },
    (prev, next) =>
        prev.source === next.source &&
        !!prev.isStreaming === !!next.isStreaming &&
        prev.mode === next.mode,
);

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        OpenUIBlock: typeof OpenUIBlock;
    }
}
