/**
 * TrueFoundry-specific type extensions over the runtime's generic bases.
 *
 * The runtime defines opaque mount bases (`SkillMount` / `McpServerMount` =
 * `object`) that hosts intersect with gateway shapes via generics.
 *
 * This file builds the concrete TrueFoundry types by:
 *  - Importing the runtime's AgentSpec as the base to extend.
 *  - Importing concrete sub-types from the gateway SDK namespace rather than
 *    re-defining them — they're purely gateway concepts.
 *  - Composing a TfyAgentSpec that satisfies both the runtime's
 *    `TSpec extends AgentSpec` constraint and the gateway SDK's AgentSpec shape.
 */

import type {
    AgentSpec,
    CreateSessionRequest,
    ListSessionsParams,
    SaveAgentResult,
    Session,
    Turn,
    TurnState,
} from "../../server/types.js";
import type { TruefoundryGatewayApi } from "truefoundry-gateway-sdk";

// ---------------------------------------------------------------------------
// Re-exports — gateway sub-types surfaced for host convenience
// ---------------------------------------------------------------------------

export type TfyRuntimeConfig = TruefoundryGatewayApi.RuntimeConfig;
export type TfyResponseFormat = TruefoundryGatewayApi.ResponseFormat;
export type TfyModelParams = TruefoundryGatewayApi.ModelParams;
export type TfySubject = TruefoundryGatewayApi.Subject;

// ---------------------------------------------------------------------------
// Tool selector helpers (mirrors gateway SDK enum values)
// ---------------------------------------------------------------------------

export type ToolsSelectorTag = "@all" | "@read-only";
export type RequireApprovalToolsSelectorTag = "@all" | "@write" | "@destructive";
export type ToolsSelectorItem = ToolsSelectorTag | string;
export type RequireApprovalToolSelectorItem = RequireApprovalToolsSelectorTag | string;

// ---------------------------------------------------------------------------
// Runtime mount bases — derived from AgentSpec, which the runtime does export
// (SkillMount / McpServerMount themselves are not part of its public API).
// ---------------------------------------------------------------------------

type RuntimeSkillMount = NonNullable<NonNullable<AgentSpec["skills"]>[number]>;
type RuntimeMcpServerMount = NonNullable<NonNullable<AgentSpec["mcpServers"]>[number]>;

// ---------------------------------------------------------------------------
// Mounts — runtime base + gateway fields (fqn, type, url, tool selectors)
// ---------------------------------------------------------------------------

// Both gateway types are unions (git vs registry source, inline vs registry
// server), so these must be intersections — an interface cannot `extends` a
// union, and doing so silently degrades to the runtime base under skipLibCheck.
export type TfySkillMount = RuntimeSkillMount & TruefoundryGatewayApi.SkillMount;

export type TfyMcpServerMount = RuntimeMcpServerMount & TruefoundryGatewayApi.McpServer;

// ---------------------------------------------------------------------------
// AgentSpec — the concrete TrueFoundry agent definition
// ---------------------------------------------------------------------------

export interface TfyCollaborator {
    subject: string;
    roleId: string;
}

export interface TfyAgentSpec
    extends AgentSpec<
        TruefoundryGatewayApi.Model,
        TfySkillMount,
        TfyMcpServerMount,
        TruefoundryGatewayApi.RuntimeConfig
    > {
    responseFormat?: TruefoundryGatewayApi.ResponseFormat;
    messages?: TruefoundryGatewayApi.AgentSpecUserMessage[];
    metadataTags?: Record<string, string>;
    collaborators?: TfyCollaborator[];
}

export type TfySaveAgentResult = SaveAgentResult;

// ---------------------------------------------------------------------------
// Turn — runtime base narrowed to the gateway's concrete state shapes
// ---------------------------------------------------------------------------

export type TfyTurnCancelledReason = TruefoundryGatewayApi.TurnStateCancelledReason;
export type TfyTurnStateDoneOutput = TruefoundryGatewayApi.TurnStateDoneOutput;

type RuntimeTurnStateDone = Extract<TurnState, { status: "done" }>;
type RuntimeTurnStateCancelled = Extract<TurnState, { status: "cancelled" }>;

/**
 * The runtime types `output` as `unknown` and `reason` as bare `string`. The
 * gateway sends a model message and one of four reasons — `cancelled-for-next-turn`
 * in particular is routine and should not render like a failure.
 */
export type TfyTurnState =
    | Exclude<TurnState, { status: "done" | "cancelled" }>
    | (Omit<RuntimeTurnStateDone, "output"> & { output?: TfyTurnStateDoneOutput })
    | (Omit<RuntimeTurnStateCancelled, "reason"> & { reason: TfyTurnCancelledReason });

export interface TfyTurn extends Turn {
    state: TfyTurnState;
    createdBySubject: TfySubject;
}

// ---------------------------------------------------------------------------
// Session and request params — runtime bases + gateway-only fields
// ---------------------------------------------------------------------------

export interface TfySession<TSpec extends TfyAgentSpec = TfyAgentSpec>
    extends Session<TSpec> {
    createdBySubject: TfySubject;
}

export interface TfyCreateSessionRequest<TSpec extends TfyAgentSpec = TfyAgentSpec>
    extends CreateSessionRequest<TSpec> {
    /** Sent as `x-tfy-metadata`, persisted server-side as `request_metadata`. */
    tfyMetadata?: string;
}

export interface TfyListSessionsParams extends ListSessionsParams {
    /** Inclusive upper bound on `createdAt` (ISO-8601). */
    endTimestamp?: string;
}

// ---------------------------------------------------------------------------
// Event-side types.
//
// These do NOT flow through AgentChatServer — its listEvents / listTurnEvents /
// subscribeToTurn / createTurn signatures hardcode the runtime's
// event types with no generic to override. Hosts narrow at the point of use
// with the guards in `guards.ts`.
// ---------------------------------------------------------------------------

export type TfyToolInfo = TruefoundryGatewayApi.ToolInfo;
export type TfySystemToolInfo = TruefoundryGatewayApi.TrueFoundrySystemToolInfo;
export type TfyMcpToolInfo = TruefoundryGatewayApi.McpToolInfo;
export type TfyModelMessageUsage = TruefoundryGatewayApi.ModelMessageUsage;
export type TfyFinishReason = TruefoundryGatewayApi.FinishReason;
export type TfyThreadState = TruefoundryGatewayApi.ThreadState;
export type TfyMcpServerInitInfo = TruefoundryGatewayApi.McpServerInitInfo;
