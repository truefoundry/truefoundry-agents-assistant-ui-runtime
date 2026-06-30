/// <reference types="@assistant-ui/core/react" />

export { useTrueFoundryAgentRuntime } from "./useTrueFoundryAgentRuntime.js";
export {
    convertTurnsToThreadMessages,
    buildUserMessageContent,
    getTurnMessageContent,
    buildTurnAssistantContent,
    repositoryItemsFromMessages,
} from "./convertTurnMessages.js";
export type { ConvertTurnsResult, UserMessageContent } from "./convertTurnMessages.js";
export { ROOT_THREAD_ID } from "./constants.js";
export type { UseTrueFoundryAgentRuntimeOptions } from "./types.js";
export type { SubAgentArtifact, SubAgentCustomMetadata } from "./foldPeerThreads.js";
export type {
    TrueFoundryMessageCustomMetadata,
    SubAgentMessageCustomMetadata,
    McpAuthMessageCustomMetadata,
    ToolApprovalMessageCustomMetadata,
    ToolResponseMessageCustomMetadata,
} from "./messageCustomMetadata.js";
export type { PendingApproval, PendingToolResponse } from "./collectPending.js";
export type { TrueFoundryRuntimeExtras } from "./truefoundryExtras.js";
export { trueFoundryExtras } from "./truefoundryExtras.js";
export {
    useTrueFoundryApprovals,
    useTrueFoundryToolResponses,
    useTrueFoundryMcpAuth,
    useTrueFoundryRespondToToolApproval,
    useTrueFoundryRespondToToolResponse,
    useTrueFoundryResumeMcpAuth,
    useTrueFoundryCancel,
} from "./hooks.js";
export {
    collectApprovalInputs,
    messageHasPendingApprovals,
    toTrueFoundryApprovalInputs,
} from "./toolApproval.js";
export {
    collectResponseInputs,
    messageHasPendingResponses,
    TOOL_RESPONSE_THREAD_ID_CUSTOM_KEY,
} from "./toolResponse.js";
export {
    collectRequiredActionInputs,
    messageHasPendingRequiredActions,
    findPausedAssistantMessage,
} from "./requiredActionInputs.js";
export { createTrueFoundryThreadListAdapter } from "./truefoundryThreadListAdapter.js";
export { getSession } from "./sessions.js";
export { trueFoundryAttachmentAdapter } from "./attachmentAdapter.js";
