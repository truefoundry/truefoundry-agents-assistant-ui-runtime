import { Box, Text } from "ink";
import {
    ThreadPrimitive,
    ComposerPrimitive,
    MessagePrimitive,
    ErrorPrimitive,
    LoadingPrimitive,
} from "@assistant-ui/react-ink";
import { MarkdownText } from "@assistant-ui/react-ink-markdown";

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

        <ThreadPrimitive.Messages>
            {({ message }) =>
                message.role === "user" ? <UserMessage /> : <AssistantMessage />
            }
        </ThreadPrimitive.Messages>

        <Loading />

        <Box borderStyle="round" borderColor="gray" paddingX={1}>
            <Text color="gray">{"> "}</Text>
            <ComposerPrimitive.Input
                submitOnEnter
                multiLine
                placeholder="Type a message…"
                autoFocus
            />
        </Box>
    </ThreadPrimitive.Root>
);
