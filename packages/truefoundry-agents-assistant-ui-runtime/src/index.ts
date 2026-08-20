/// <reference types="@assistant-ui/core/react" />

export { useAgentRuntime } from "./useAgentRuntime.js";
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
    AgentConfig,
    UseAgentRuntimeOptions,
} from "./types.js";
export type { AgentSpecUpdate, DraftSession } from "./draft/agentSpec.js";
export { mergeAgentSpec, draftSessionTitle } from "./draft/agentSpec.js";
export { createDraftThreadListAdapter } from "./draft/draftThreadListAdapter.js";
export { createOwnedSessionsThreadListAdapter } from "./ownedSessionsThreadListAdapter.js";
export { createDraftSessionBridge } from "./draft/draftSessionBridge.js";
export type { DraftSessionBridge } from "./draft/draftSessionBridge.js";
export {
    useAdoptAgentSpec,
    useAgentSpec,
    useFlushAgentSpec,
    useUpdateAgentSpec,
} from "./hooks.js";
export type { DraftRuntimeExtras } from "./agentExtras.js";
export type { SubAgentArtifact, SubAgentCustomMetadata } from "./foldPeerThreads.js";
export type {
    AgentMessageCustomMetadata,
    SubAgentMessageCustomMetadata,
    McpAuthMessageCustomMetadata,
    SandboxMessageCustomMetadata,
    ToolApprovalMessageCustomMetadata,
    ToolResponseMessageCustomMetadata,
} from "./messageCustomMetadata.js";
export type { PendingApproval, PendingToolResponse } from "./collectPending.js";
export type { AgentRuntimeExtras } from "./agentExtras.js";
export {
    agentExtras,
    getAgentExtras,
    tryGetAgentExtras,
} from "./agentExtras.js";
export {
    useApprovals,
    useToolResponses,
    useMcpAuth,
    useRespondToToolApproval,
    useRespondToToolResponse,
    useResumeMcpAuth,
    useSandboxId,
    useTurnId,
    useDownloadSandboxFile,
    useCancel,
    useResetFromTurn,
    useReload,
    useHistoryPagination,
    useResumeUnavailable,
} from "./hooks.js";
export {
    collectApprovalInputs,
    messageHasPendingApprovals,
    toApprovalInputs,
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
export { createThreadListAdapter } from "./threadListAdapter.js";
export { getSession } from "./sessions.js";
export { agentAttachmentAdapter } from "./attachmentAdapter.js";

export type {
    AgentChatServer,
    AgentBuilderCapabilitiesResponse,
    AgentBuilderServer,
    AgentCapabilityConfig,
    AgentRuntimeConfig,
    SaveAgentRequest,
    SaveAgentResult,
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
    ApprovalDecision,
    PreviousTurnIdInput,
    ProviderType,
    PageParams,
    ListSessionsOrder,
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
    AuthenticateConnectorRequest,
    ConnectorAuthenticationResult,
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
    SandboxSnapshotSyncStatus,
    SandboxProviderListEntry,
    CreateSandboxRequest,
    UpdateSandboxRequest,
    SandboxProviderConfig,
    SandboxProviderCatalogEntry,
    SandboxProviderBase,
    CreateSandboxProviderRequest,
    UpdateSandboxProviderRequest,
    SandboxCatalogServer,
    CatalogServer,
    AgentUIServerPort,
    AgentUIServer,
    ProviderEntry,
    ModelProperties,
    ModelSelectorEntry,
    SkillSelectorEntry,
    ConnectorSelectorEntry,
    AgentSelectorEntry,
    SearchAgentSelectorParams,
    ModelSelection,
    AgentSkill,
    ConnectorState,
    AgentLibraryEntry,
    SearchAgentsParams,
    SkillMount,
    McpServerMount,
    ModelParams,
    Model,
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
