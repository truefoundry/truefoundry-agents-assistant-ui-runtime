/// <reference types="@assistant-ui/core/react" />

export { useTrueFoundryAgentRuntime } from "./useTrueFoundryAgentRuntime.js";
export {
    convertTurnsToThreadMessages,
    buildUserMessageContent,
    buildEditedUserMessageContent,
    getTurnMessageContent,
    parseTurnIdFromMessageId,
    buildTurnAssistantContent,
    repositoryItemsFromMessages,
} from "./convertTurnMessages.js";
export type { ConvertTurnsResult, UserMessageContent } from "./convertTurnMessages.js";
export { ROOT_THREAD_ID } from "./constants.js";
export type {
    NamedAgentConfig,
    DraftAgentConfig,
    TrueFoundryAgentConfig,
    UseTrueFoundryAgentRuntimeOptions,
} from "./types.js";
export type { AgentSpecUpdate, DraftSession } from "./draft/agentSpec.js";
export { mergeAgentSpec, draftSessionTitle } from "./draft/agentSpec.js";
export { createTrueFoundryDraftThreadListAdapter } from "./draft/truefoundryDraftThreadListAdapter.js";
export { createTrueFoundryOwnedSessionsThreadListAdapter } from "./truefoundryOwnedSessionsThreadListAdapter.js";
export { createDraftSessionBridge } from "./draft/draftSessionBridge.js";
export type { DraftSessionBridge } from "./draft/draftSessionBridge.js";
export {
    useTrueFoundryAgentSpec,
    useTrueFoundryUpdateAgentSpec,
} from "./hooks.js";
export type { TrueFoundryDraftRuntimeExtras } from "./truefoundryExtras.js";
export type { SubAgentArtifact, SubAgentCustomMetadata } from "./foldPeerThreads.js";
export type {
    TrueFoundryMessageCustomMetadata,
    SubAgentMessageCustomMetadata,
    McpAuthMessageCustomMetadata,
    SandboxMessageCustomMetadata,
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
    useTrueFoundrySandboxId,
    useTrueFoundryDownloadSandboxFile,
    useTrueFoundryCancel,
    useTrueFoundryResetFromTurn,
    useTrueFoundryReload,
    useTrueFoundryHistoryPagination,
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

export type {
    AgentChatServer,
    AgentBuilderServer,
    Session,
    Turn,
    TurnState,
    TurnStateDone,
    TurnInputItem,
    AgentSpec,
    ListResult,
    CreateSessionRequest,
    UpdateSessionRequest,
    ListSessionsParams,
    UserMessage,
    UserToolApprovalEvent,
    UserToolResponseEvent,
    PreviousTurnIdInput,
    ProviderType,
    ModelEntry,
    ModelProviderConfigBase,
    ModelProviderBase,
    ModelProviderCatalogEntry,
    CreateModelProviderRequest,
    UpdateModelProviderRequest,
    ModelCatalogServer,
    ToolBase,
    ConnectorAuthType,
    ConnectorAuthOAuth,
    ConnectorAuthApiKey,
    ConnectorAuthNone,
    ConnectorAuth,
    ConnectorAuthPublicOAuth,
    ConnectorAuthPublicApiKey,
    ConnectorAuthPublicNone,
    ConnectorAuthPublic,
    ConnectorConfigBase,
    ConnectorBase,
    ConnectorCatalogEntry,
    CreateConnectorRequest,
    UpdateConnectorRequest,
    ConnectorCatalogServer,
    SkillBase,
    RegistrySkill,
    GithubSkill,
    DefinedSkill,
    SkillConfigBase,
    SkillCatalogEntry,
    CreateSkillRequestBase,
    SelectRegistrySkillRequest,
    ImportGithubSkillRequest,
    CreateSkillRequest,
    SkillCatalogServer,
    SandboxConfig,
    SandboxCatalogEntry,
    SandboxBase,
    CreateSandboxRequest,
    UpdateSandboxRequest,
    SandboxCatalogServer,
    CatalogServer,
    AgentUIServerPort,
} from "./server/index.js";
export type {
    SandboxCreatedEvent,
    McpAuthRequiredEvent,
    ModelMessageEvent,
    TurnEvent,
    TurnStreamingEvent,
    TurnStreamData,
    SessionEventItem,
    ToolCall,
    ThreadCreatedEvent,
    ToolApprovalRequiredEvent,
    ToolResponseRequiredEvent,
} from "./server/index.js";
export { isEventDelta, mergeEventDelta } from "./server/index.js";

// ---------------------------------------------------------------------------
// Plugin: truefoundry-agent-server-adapter
// ---------------------------------------------------------------------------

export {
    createTrueFoundryChatServer,
    createTrueFoundryAgentUIServer,
    type CreateTrueFoundryChatServerOptions,
    type TrueFoundryChatServer,
    type CreateTrueFoundryAgentUIServerOptions,
    type TrueFoundryAgentUIServer,
    type TfyModelSelectorEntry,
    type TfySkillSelectorEntry,
    type TfyConnectorSelectorEntry,
    type TfyAgentSelectorEntry,
    type TfyAgentSpec,
    type TfySkillMount,
    type TfyMcpServerMount,
    type TfyModelParams,
    type TfyRuntimeConfig,
    type TfyResponseFormat,
    type TfySubject,
    type ToolsSelectorItem,
    type ToolsSelectorTag,
    type RequireApprovalToolSelectorItem,
    type RequireApprovalToolsSelectorTag,
    type TfyTurn,
    type TfyTurnState,
    type TfyTurnCancelledReason,
    type TfyTurnStateDoneOutput,
    type TfySession,
    type TfyCreateSessionRequest,
    type TfyListSessionsParams,
    type TfyToolInfo,
    type TfySystemToolInfo,
    type TfyMcpToolInfo,
    type TfyModelMessageUsage,
    type TfyFinishReason,
    type TfyThreadState,
    type TfyMcpServerInitInfo,
    isTfyToolInfo,
    isTfySystemToolInfo,
    isTfyMcpToolInfo,
    getTfyUsage,
    getTfyThreadState,
    getTfyMcpInitServers,
} from "./plugins/truefoundry-agent-server-adapter/index.js";
