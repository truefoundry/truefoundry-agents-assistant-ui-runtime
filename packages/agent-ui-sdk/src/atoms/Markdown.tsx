import { Children, isValidElement, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "./lib/cn.js";
import { CodeBlockHeader } from "./CodeBlockHeader.js";
import { OpenUIBlock } from "./OpenUIBlock.js";
import { SandboxArtifactList, type SandboxArtifactLink } from "./SandboxArtifactList.js";

function extractCodeText(node: ReactNode): string {
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractCodeText).join("");
    if (isValidElement(node)) {
        return extractCodeText((node.props as { children?: ReactNode }).children);
    }
    return "";
}

const SANDBOX_ARTIFACT_TOKEN = "sandbox_artifact";

/**
 * By the time this runs, `[Label](path)` has already been parsed into a real
 * `<a href="path">Label</a>` element by react-markdown — the raw path text is
 * gone from any flattened string, only present as the anchor's `href` prop.
 * So detection walks `children` as React elements, not a flattened string.
 */
/**
 * The gateway emits sandbox artifact links as a fenced code block tagged
 * ```sandbox_artifact(s)``` containing raw `[label](path)` markdown-link text
 * (never parsed into real anchors, since it's inside a code fence).
 */
function parseSandboxArtifactCodeBlock(code: string): SandboxArtifactLink[] | null {
    const links: SandboxArtifactLink[] = [];
    for (const match of code.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
        links.push({ label: match[1]!, path: match[2]! });
    }
    return links.length > 0 ? links : null;
}

function parseSandboxArtifactParagraph(children: ReactNode): SandboxArtifactLink[] | null {
    const items = Children.toArray(children);
    if (items.length === 0) return null;

    const first = items[0];
    if (typeof first !== "string") return null;
    const stripped = first.replace(/^\s*/, "");
    if (!stripped.startsWith(SANDBOX_ARTIFACT_TOKEN)) return null;
    if (!/^\s*$/.test(stripped.slice(SANDBOX_ARTIFACT_TOKEN.length))) return null;

    const links: SandboxArtifactLink[] = [];
    for (let i = 1; i < items.length; i++) {
        const item = items[i];
        if (typeof item === "string") {
            const trimmed = item.trim();
            if (trimmed === "" || trimmed === SANDBOX_ARTIFACT_TOKEN) continue;
            return null;
        }
        if (isValidElement(item) && typeof (item.props as { href?: unknown }).href === "string") {
            links.push({
                label: extractCodeText((item.props as { children?: ReactNode }).children),
                path: (item.props as { href: string }).href,
            });
            continue;
        }
        return null;
    }
    return links.length > 0 ? links : null;
}

function createMarkdownComponents(
    isStreaming?: boolean,
    onDownloadArtifact?: (path: string) => void | Promise<unknown>,
): Components {
    return {
    h1: ({ className, ...props }) => (
        <h1
            className={cn(
                "aui-md-h1 mt-5 mb-2 scroll-m-20 text-xl font-semibold first:mt-0 last:mb-0",
                className,
            )}
            {...props}
        />
    ),
    h2: ({ className, ...props }) => (
        <h2
            className={cn(
                "aui-md-h2 mt-5 mb-2 scroll-m-20 text-lg font-semibold first:mt-0 last:mb-0",
                className,
            )}
            {...props}
        />
    ),
    h3: ({ className, ...props }) => (
        <h3
            className={cn(
                "aui-md-h3 mt-4 mb-1.5 scroll-m-20 text-base font-semibold first:mt-0 last:mb-0",
                className,
            )}
            {...props}
        />
    ),
    h4: ({ className, ...props }) => (
        <h4
            className={cn(
                "aui-md-h4 mt-3.5 mb-1 scroll-m-20 text-base font-medium first:mt-0 last:mb-0",
                className,
            )}
            {...props}
        />
    ),
    h5: ({ className, ...props }) => (
        <h5
            className={cn("aui-md-h5 mt-3 mb-1 text-sm font-semibold first:mt-0 last:mb-0", className)}
            {...props}
        />
    ),
    h6: ({ className, ...props }) => (
        <h6
            className={cn("aui-md-h6 mt-3 mb-1 text-sm font-medium first:mt-0 last:mb-0", className)}
            {...props}
        />
    ),
    p: ({ className, children, ...props }) => {
        const artifacts = parseSandboxArtifactParagraph(children);
        if (artifacts != null) {
            return <SandboxArtifactList artifacts={artifacts} onDownload={onDownloadArtifact} />;
        }
        return (
            <p className={cn("aui-md-p my-3 leading-relaxed first:mt-0 last:mb-0", className)} {...props}>
                {children}
            </p>
        );
    },
    a: ({ className, ...props }) => (
        <a
            className={cn(
                "aui-md-a text-primary hover:text-primary/80 underline underline-offset-2",
                className,
            )}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
        />
    ),
    blockquote: ({ className, ...props }) => (
        <blockquote
            className={cn(
                "aui-md-blockquote border-muted-foreground/30 text-muted-foreground my-3 border-s-2 ps-4",
                className,
            )}
            {...props}
        />
    ),
    ul: ({ className, ...props }) => (
        <ul
            className={cn(
                "aui-md-ul marker:text-muted-foreground my-3 ms-5 list-disc [&>li]:mt-1",
                className,
            )}
            {...props}
        />
    ),
    ol: ({ className, ...props }) => (
        <ol
            className={cn(
                "aui-md-ol marker:text-muted-foreground my-3 ms-5 list-decimal [&>li]:mt-1",
                className,
            )}
            {...props}
        />
    ),
    hr: ({ className, ...props }) => (
        <hr className={cn("aui-md-hr border-muted-foreground/20 my-3", className)} {...props} />
    ),
    table: ({ className, ...props }) => (
        <table
            className={cn(
                "aui-md-table my-3 w-full border-separate border-spacing-0 overflow-y-auto",
                className,
            )}
            {...props}
        />
    ),
    th: ({ className, ...props }) => (
        <th
            className={cn(
                "aui-md-th bg-muted px-3 py-1.5 text-start font-medium first:rounded-ss-lg last:rounded-se-lg [[align=center]]:text-center [[align=right]]:text-right",
                className,
            )}
            {...props}
        />
    ),
    td: ({ className, ...props }) => (
        <td
            className={cn(
                "aui-md-td border-muted-foreground/20 border-s border-b px-3 py-1.5 text-start last:border-e [[align=center]]:text-center [[align=right]]:text-right",
                className,
            )}
            {...props}
        />
    ),
    tr: ({ className, ...props }) => (
        <tr
            className={cn(
                "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-es-lg [&:last-child>td:last-child]:rounded-ee-lg",
                className,
            )}
            {...props}
        />
    ),
    li: ({ className, ...props }) => <li className={cn("aui-md-li leading-relaxed", className)} {...props} />,
    strong: ({ className, ...props }) => (
        <strong className={cn("aui-md-strong font-semibold", className)} {...props} />
    ),
    sup: ({ className, ...props }) => (
        <sup className={cn("aui-md-sup [&>a]:text-xs [&>a]:no-underline", className)} {...props} />
    ),
    pre: ({ className, children, ...props }) => {
        const codeElement = isValidElement(children) ? children : undefined;
        const codeClassName = (codeElement?.props as { className?: string } | undefined)?.className ?? "";
        const language = /language-(\S+)/.exec(codeClassName)?.[1] ?? "text";
        const code = extractCodeText(children);
        if (language === "openui") {
            return <OpenUIBlock source={code} isStreaming={isStreaming} />;
        }
        if (language === "sandbox_artifact" || language === "sandbox_artifacts") {
            const artifacts = parseSandboxArtifactCodeBlock(code);
            if (artifacts != null) {
                return <SandboxArtifactList artifacts={artifacts} onDownload={onDownloadArtifact} />;
            }
        }
        return (
            <>
                <CodeBlockHeader language={language} code={code} />
                <pre
                    className={cn(
                        "aui-md-pre border-border/50 bg-muted/30 overflow-x-auto rounded-t-none rounded-b-xl border border-t-0 p-3.5 text-[13px] leading-relaxed",
                        className,
                    )}
                    {...props}
                >
                    {children}
                </pre>
            </>
        );
    },
    code: ({ className, ...props }) => {
        const isCodeBlock = /language-/.test(className ?? "");
        return (
            <code
                className={cn(
                    !isCodeBlock && "aui-md-inline-code bg-muted rounded-md px-1.5 py-0.5 font-mono text-[0.85em]",
                    className,
                )}
                {...props}
            />
        );
    },
    };
}

export type MarkdownProps = {
    content: string;
    className?: string;
    isStreaming?: boolean;
    onDownloadArtifact?: (path: string) => void | Promise<unknown>;
};

export function Markdown({ content, className, isStreaming, onDownloadArtifact }: MarkdownProps) {
    const components = useMemo(
        () => createMarkdownComponents(isStreaming, onDownloadArtifact),
        [isStreaming, onDownloadArtifact],
    );
    return (
        <div className={cn("aui-md", className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
            </ReactMarkdown>
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        Markdown: typeof Markdown;
    }
}
