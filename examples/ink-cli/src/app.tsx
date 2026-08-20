import { useMemo } from "react";
import { Box, Text } from "ink";
import { AssistantRuntimeProvider, StatusBarPrimitive } from "@assistant-ui/react-ink";
import { useAuiState } from "@assistant-ui/store";
import {
    createTrueFoundryAgentUIServer,
    useAgentRuntime,
    type AgentConfig,
    type TrueFoundryAgentUIServer,
} from "@truefoundry/assistant-ui-runtime";
import { Thread } from "./components/thread.js";

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        process.stderr.write(`Error: ${key} environment variable is required.\n`);
        process.exit(1);
    }
    return value;
}

export type AppProps = {
    server: TrueFoundryAgentUIServer;
    agent: AgentConfig;
    label: string;
};

const StatusBar = ({ label }: { label: string }) => {
    const sessionId = useAuiState((s) => s.threadListItem.remoteId);

    return (
        <StatusBarPrimitive.Root>
            <Text dimColor>
                agent: {label}
                {sessionId != null && <Text dimColor> · session: {sessionId}</Text>}
                {" · "}
                <StatusBarPrimitive.MessageCount /> · <StatusBarPrimitive.Status />
            </Text>
        </StatusBarPrimitive.Root>
    );
};

export const App = ({ server, agent, label }: AppProps) => {
    const agentRuntime = useAgentRuntime(
        useMemo(() => ({ server, agent }), [server, agent]),
    );

    return (
        <AssistantRuntimeProvider
            // peer @assistant-ui/core version skew between react-ink and the runtime
            runtime={agentRuntime as never}
        >
            <Box flexDirection="column" padding={1}>
                <Box gap={2}>
                    <Text bold color="cyan">
                        {label}
                    </Text>
                    <StatusBar label={label} />
                </Box>
                <Thread />
            </Box>
        </AssistantRuntimeProvider>
    );
};

/** Resolve credentials + full pack; agentName optional → draft with first CP model. */
export async function createAppServer(): Promise<{
    server: TrueFoundryAgentUIServer;
    agent: AgentConfig;
    label: string;
}> {
    const apiKey = requireEnv("TFY_API_KEY");
    const cpURL = requireEnv("TFY_CP_URL");
    const gatewayURL = process.env["TFY_GATEWAY_URL"]?.trim() || undefined;
    const agentName = process.env["TFY_AGENT_NAME"]?.trim() || undefined;

    const server = await createTrueFoundryAgentUIServer({
        apiKey,
        cpURL,
        ...(gatewayURL != null ? { gatewayURL } : {}),
    });

    if (agentName != null) {
        return {
            server,
            agent: { mode: "named", agentName },
            label: agentName,
        };
    }

    const models = await server.getModels();
    const first = models[0];
    if (first == null) {
        throw new Error(
            "No enabled chat models from Control Plane; set TFY_AGENT_NAME or enable a model.",
        );
    }

    return {
        server,
        agent: {
            mode: "draft",
            defaultAgentSpec: { model: { name: first.apiModel } },
        },
        label: `draft (${first.apiModel})`,
    };
}
