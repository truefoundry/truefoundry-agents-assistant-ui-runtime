import { useState } from "react";
import { Box, Text, useInput } from "ink";
import {
    ThreadPrimitive,
    ComposerPrimitive,
    MessagePrimitive,
    ErrorPrimitive,
    LoadingPrimitive,
} from "@assistant-ui/react-ink";
import { MarkdownText } from "@assistant-ui/react-ink-markdown";
import {
    useTrueFoundryToolResponses,
    useTrueFoundryApprovals,
    type PendingToolResponse,
} from "truefoundry-agents-assistant-ui-runtime";

// ── Ask-user question prompt ─────────────────────────────────────────────────

const ToolResponseInput = ({ pending }: { pending: PendingToolResponse }) => {
    const { respond } = useTrueFoundryToolResponses();
    const [value, setValue] = useState("");
    const [selected, setSelected] = useState(0);
    const hasOptions = pending.options != null && pending.options.length > 0;

    useInput((input, key) => {
        if (hasOptions) {
            const count = pending.options!.length;
            if (key.upArrow) {
                setSelected((prev) => (prev - 1 + count) % count);
            } else if (key.downArrow) {
                setSelected((prev) => (prev + 1) % count);
            } else if (key.return) {
                respond({
                    toolCallId: pending.toolCallId,
                    content: pending.options![selected]!,
                });
            }
        } else {
            if (key.return) {
                const answer = value.trim();
                if (answer) {
                    respond({ toolCallId: pending.toolCallId, content: answer });
                    setValue("");
                }
            } else if (key.backspace || key.delete) {
                setValue((prev) => prev.slice(0, -1));
            } else if (input && !key.ctrl && !key.meta) {
                setValue((prev) => prev + input);
            }
        }
    });

    return (
        <Box flexDirection="column" gap={1}>
            {pending.question != null && (
                <Text color="yellow">{"? "}{pending.question}</Text>
            )}
            {hasOptions ? (
                <Box flexDirection="column">
                    {pending.options!.map((opt, i) => (
                        <Text key={opt}>
                            {i === selected ? (
                                <Text color="yellow">{"❯ "}{opt}</Text>
                            ) : (
                                <Text dimColor>{"  "}{opt}</Text>
                            )}
                        </Text>
                    ))}
                    <Text dimColor>  ↑↓ navigate · Enter to select</Text>
                </Box>
            ) : (
                <Box borderStyle="round" borderColor="yellow" paddingX={1}>
                    <Text color="gray">{"> "}</Text>
                    {value !== "" ? (
                        <Text>{value}</Text>
                    ) : (
                        <Text dimColor>Type your answer… (Enter to send)</Text>
                    )}
                </Box>
            )}
        </Box>
    );
};

// ── Tool approval prompt (y/n) ───────────────────────────────────────────────

const ToolApprovalInput = () => {
    const { pending, respond } = useTrueFoundryApprovals();
    const first = pending[0];

    useInput((input) => {
        if (!first) return;
        if (input === "y" || input === "Y") {
            respond({ approvalId: first.approvalId, approved: true });
        } else if (input === "n" || input === "N") {
            respond({ approvalId: first.approvalId, approved: false });
        }
    });

    if (!first) return null;

    return (
        <Box flexDirection="column" gap={1}>
            <Text color="magenta">
                {"⚠ Allow tool call: "}
                <Text bold>{first.toolName}</Text>
                {"?"}
            </Text>
            <Text dimColor>  {first.argsText}</Text>
            <Text>
                <Text color="green">[y] Allow</Text>
                {"  "}
                <Text color="red">[n] Deny</Text>
            </Text>
        </Box>
    );
};

// ── Composer ──────────────────────────────────────────────────────────────────

const Composer = () => {
    const { pending: pendingResponses } = useTrueFoundryToolResponses();
    const { pending: pendingApprovals } = useTrueFoundryApprovals();

    if (pendingResponses.length > 0) {
        return <ToolResponseInput pending={pendingResponses[0]!} />;
    }

    if (pendingApprovals.length > 0) {
        return <ToolApprovalInput />;
    }

    return (
        <Box borderStyle="round" borderColor="gray" paddingX={1}>
            <Text color="gray">{"> "}</Text>
            <ComposerPrimitive.Input
                submitOnEnter
                multiLine
                placeholder="Type a message…"
                autoFocus
            />
        </Box>
    );
};

// ── Messages ──────────────────────────────────────────────────────────────────

const UserMessage = () => (
    <MessagePrimitive.Root>
        <Box marginBottom={1}>
            <Text bold color="green">
                {"You: "}
            </Text>
            <MessagePrimitive.Content
                renderText={({ part }) => <Text wrap="wrap">{part.text}</Text>}
            />
        </Box>
    </MessagePrimitive.Root>
);

const AssistantMessage = () => (
    <MessagePrimitive.Root>
        <Box flexDirection="column" marginBottom={1}>
            <Text bold color="blue">
                Agent:
            </Text>
            <MessagePrimitive.Content
                renderText={({ part }) => <MarkdownText text={part.text} />}
                renderReasoning={({ part }) => (
                    <Text dimColor italic>
                        {part.text}
                    </Text>
                )}
                renderToolCall={({ part }) => (
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor>
                            {"  ⚙ "}
                            <Text color="yellow">{part.toolName}</Text>
                            {part.result !== undefined ? (
                                part.isError ? (
                                    <Text color="red"> ✗</Text>
                                ) : (
                                    <Text color="green"> ✓</Text>
                                )
                            ) : part.approval !== undefined &&
                              part.approval.approved === undefined ? (
                                <Text color="magenta"> (awaiting approval)</Text>
                            ) : part.interrupt !== undefined ? (
                                <Text color="magenta"> (awaiting input)</Text>
                            ) : (
                                <Text dimColor> …</Text>
                            )}
                        </Text>
                    </Box>
                )}
            />
            <ErrorPrimitive.Root>
                <ErrorPrimitive.Message />
            </ErrorPrimitive.Root>
        </Box>
    </MessagePrimitive.Root>
);

const Loading = () => (
    <LoadingPrimitive.Root marginBottom={1}>
        <LoadingPrimitive.Spinner />
        <Text> </Text>
        <LoadingPrimitive.Text>Thinking</LoadingPrimitive.Text>
        <Text> </Text>
        <LoadingPrimitive.ElapsedTime />
    </LoadingPrimitive.Root>
);

export const Thread = () => (
    <ThreadPrimitive.Root>
        <ThreadPrimitive.Empty>
            <Box marginBottom={1}>
                <Text dimColor>
                    {"Start a conversation. Press Enter to send, Ctrl+C to exit."}
                </Text>
            </Box>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages windowSize={20}>
            {({ message }) =>
                message.role === "user" ? <UserMessage /> : <AssistantMessage />
            }
        </ThreadPrimitive.Messages>

        <Loading />

        <Composer />
    </ThreadPrimitive.Root>
);
