import type { ToolCall } from "truefoundry-gateway-sdk/agents";

export function isCreateSubAgentToolCall(toolCall: Pick<ToolCall, "toolInfo">): boolean {
    return (
        toolCall.toolInfo.type === "truefoundry-system" &&
        toolCall.toolInfo.name === "create_sub_agent"
    );
}
