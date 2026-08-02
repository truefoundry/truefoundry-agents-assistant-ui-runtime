/**
 * Point-of-use narrowing for the event half of the gateway protocol.
 *
 * `AgentChatServer` hardcodes the runtime's event types on listEvents,
 * listTurnEvents, subscribeToTurn and prepareAndExecuteTurn — there is no
 * generic to override them from here. So instead of typing those channels,
 * hosts call these guards on the values they receive.
 *
 * They validate rather than cast: this data comes off the network, and the
 * runtime types the relevant fields as `unknown` precisely because nothing
 * has checked them yet.
 */

import type {
    TfyMcpServerInitInfo,
    TfyMcpToolInfo,
    TfyModelMessageUsage,
    TfySystemToolInfo,
    TfyThreadState,
    TfyToolInfo,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function hasNumbers<K extends string>(
    value: unknown,
    keys: readonly K[],
): value is Record<string, unknown> & Record<K, number> {
    return isRecord(value) && keys.every((key) => typeof value[key] === "number");
}

/**
 * Identifies built-in tools such as `ask_user_question` and `create_sub_agent`.
 * Note `toolInfo` is legitimately absent on streamed deltas, so callers must
 * keep their `function.name` fallback rather than treating absence as an error.
 */
export function isTfySystemToolInfo(
    toolInfo: unknown,
): toolInfo is TfySystemToolInfo {
    return (
        isRecord(toolInfo) &&
        toolInfo.type === "truefoundry-system" &&
        typeof toolInfo.name === "string"
    );
}

/** Carries `serverId` / `serverName`, so the UI can attribute a call to its MCP server. */
export function isTfyMcpToolInfo(toolInfo: unknown): toolInfo is TfyMcpToolInfo {
    return (
        isRecord(toolInfo) &&
        toolInfo.type === "mcp" &&
        typeof toolInfo.name === "string" &&
        typeof toolInfo.serverId === "string" &&
        typeof toolInfo.serverName === "string"
    );
}

export function isTfyToolInfo(toolInfo: unknown): toolInfo is TfyToolInfo {
    return isTfySystemToolInfo(toolInfo) || isTfyMcpToolInfo(toolInfo);
}

const USAGE_BREAKDOWN_KEYS = [
    "harness",
    "skills",
    "instructions",
    "toolDefinitions",
    "messages",
] as const;

/**
 * Token usage including the TrueFoundry-specific `inputTokensBreakdown`, which
 * attributes input tokens across harness, skills, instructions, tool
 * definitions and messages.
 */
export function getTfyUsage(
    source: { usage?: unknown } | null | undefined,
): TfyModelMessageUsage | undefined {
    const usage = source?.usage;
    if (!hasNumbers(usage, ["inputTokens", "outputTokens"])) {
        return undefined;
    }
    if (!hasNumbers(usage.inputTokensBreakdown, USAGE_BREAKDOWN_KEYS)) {
        return undefined;
    }
    return usage as unknown as TfyModelMessageUsage;
}

/**
 * Completion state of a sub-agent thread. The runtime types `thread.done`'s
 * `state` as `unknown`, so a sub-agent that errored is otherwise
 * indistinguishable from one that succeeded.
 */
export function getTfyThreadState(
    event: { state?: unknown } | null | undefined,
): TfyThreadState | undefined {
    const state = event?.state;
    if (!isRecord(state)) {
        return undefined;
    }
    if (state.status === "done" && isRecord(state.output)) {
        return state as unknown as TfyThreadState;
    }
    if (state.status === "error" && typeof state.error === "string") {
        return state as unknown as TfyThreadState;
    }
    return undefined;
}

/**
 * Servers from an `mcp.initialize` event, including each one's `transportType`.
 * The runtime models this event with an index signature, so the array is
 * `unknown` until checked.
 */
export function getTfyMcpInitServers(
    event: { mcpServers?: unknown } | null | undefined,
): TfyMcpServerInitInfo[] | undefined {
    const servers = event?.mcpServers;
    if (!Array.isArray(servers)) {
        return undefined;
    }
    const valid = servers.every(
        (server) =>
            isRecord(server) &&
            typeof server.id === "string" &&
            typeof server.name === "string",
    );
    return valid ? (servers as TfyMcpServerInitInfo[]) : undefined;
}
