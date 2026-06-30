import { useMemo } from "react";
import { Box, Text } from "ink";
import { AssistantRuntimeProvider, StatusBarPrimitive } from "@assistant-ui/react-ink";
import { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import { useTrueFoundryAgentRuntime } from "truefoundry-agents-assistant-ui-runtime";
import { Thread } from "./components/thread.js";

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        process.stderr.write(`Error: ${key} environment variable is required.\n`);
        process.exit(1);
    }
    return value;
}

const apiKey = requireEnv("TFY_API_KEY");
const gatewayUrl = requireEnv("TFY_GATEWAY_URL");
const agentName = process.env["TFY_AGENT_NAME"] ?? "my-agent";

const client = new AgentSessionClient({ apiKey, baseUrl: gatewayUrl });

const StatusBar = () => (
    <StatusBarPrimitive.Root>
        <Text dimColor>
            agent: {agentName} · <StatusBarPrimitive.MessageCount /> ·{" "}
            <StatusBarPrimitive.Status />
        </Text>
    </StatusBarPrimitive.Root>
);

export const App = () => {
    const agentRuntime = useTrueFoundryAgentRuntime(
        useMemo(() => ({ client, agentName }), []),
    );

    return (
        <AssistantRuntimeProvider runtime={agentRuntime}>
            <Box flexDirection="column" padding={1}>
                <Box gap={2}>
                    <Text bold color="cyan">
                        {agentName}
                    </Text>
                    <Text dimColor>TrueFoundry Agent</Text>
                </Box>
                <StatusBar />
                <Box marginTop={1}>
                    <Thread />
                </Box>
            </Box>
        </AssistantRuntimeProvider>
    );
};
