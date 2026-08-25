/**
 * Compile-time assertions for the mount types in `types.ts`.
 *
 * TfySkillMount / TfyMcpServerMount are built by indexing into the runtime's
 * exported AgentSpec. If that indexed access ever degrades to `unknown`, the
 * intersection becomes a silent no-op and the gateway fields disappear without
 * any error. These assertions fail `pnpm typecheck` if that happens.
 *
 * Not an entry point — tsup only bundles src/index.ts.
 */

import type { AgentSpec } from "../../server/types.js";
import type { createTrueFoundryChatServer } from "./index.js";
import type {
    TfyAgentSpec,
    TfyFinishReason,
    TfyMcpServerMount,
    TfySaveAgentResult,
    TfySkillMount,
    TfySubject,
    TfyTurn,
} from "./types.js";

// Both gateway source variants must survive the intersection with the base.
export const registrySkill: TfySkillMount = {
    type: "truefoundry-skills-registry",
    fqn: "tfy:skill:v1",
    preload: true,
};

export const gitSkill: TfySkillMount = {
    type: "git",
    url: "https://github.com/acme/skills",
    name: "reviewer",
    ref: "main",
};

// @ts-expect-error the type discriminant must survive the intersection
export const skillWithoutType: TfySkillMount = { fqn: "a" };

// @ts-expect-error registry variant requires fqn
export const registrySkillWithoutFqn: TfySkillMount = {
    type: "truefoundry-skills-registry",
};

export const registeredMcp: TfyMcpServerMount = {
    name: "github",
    type: "truefoundry-mcp-registry",
    enableTools: ["@read-only"],
    requireApprovalForTools: ["@destructive"],
};

export const inlineMcp: TfyMcpServerMount = {
    name: "custom",
    type: "inline",
    url: "https://example.com/mcp",
};

// @ts-expect-error the type discriminant must survive the intersection
export const mcpWithoutType: TfyMcpServerMount = { name: "a" };

// @ts-expect-error inline variant requires url
export const inlineMcpWithoutUrl: TfyMcpServerMount = {
    name: "a",
    type: "inline",
};

// The gateway's own spec — a registry skill carries neither `id` nor `name` —
// must satisfy the runtime base. A base that rejects it makes every server
// response unassignable, which is the regression these mounts are guarding.
declare const gatewayShapedSpec: TfyAgentSpec;
export const asRuntimeSpec: AgentSpec = gatewayShapedSpec;

// ---------------------------------------------------------------------------
// Generic TSpec — a host extension must reach the returned server's types,
// and the bare (defaulted) form must keep working.
// ---------------------------------------------------------------------------

interface HostSpec extends TfyAgentSpec {
    workspaceId: string;
}

type HostServer = ReturnType<typeof createTrueFoundryChatServer<HostSpec>>;
type DefaultServer = ReturnType<typeof createTrueFoundryChatServer>;

declare const hostSession: Awaited<ReturnType<HostServer["getSession"]>>;
declare const defaultSession: Awaited<ReturnType<DefaultServer["getSession"]>>;

// Host field is visible on the spec returned by the generic server.
export const workspaceId: string | undefined = hostSession.agentSpec?.workspaceId;

// Gateway fields still flow through alongside it.
export const hostSkills: TfySkillMount[] | undefined = hostSession.agentSpec?.skills;

// @ts-expect-error the default instantiation must NOT have the host's field
export const leakedWorkspaceId = defaultSession.agentSpec?.workspaceId;

// Host spec is accepted where the server expects one.
export declare function createHostSession(
    server: HostServer,
    spec: HostSpec,
): ReturnType<HostServer["createSession"]>;

// ---------------------------------------------------------------------------
// Turn — the gateway narrowings must not collapse back into the runtime's
// `unknown` output / bare-`string` reason.
// ---------------------------------------------------------------------------

const subject: TfySubject = {
    subjectId: "u-1",
    subjectType: "user",
    subjectSlug: "someone",
};

export const cancelledTurn: TfyTurn = {
    id: "turn-1",
    sessionId: "session-1",
    state: {
        status: "cancelled",
        reason: "cancelled-for-next-turn",
        completedAt: "2026-01-01T00:00:00Z",
    },
    createdBySubject: subject,
    createdAt: "2026-01-01T00:00:00Z",
};

export const freeformCancelReason: TfyTurn = {
    ...cancelledTurn,
    // @ts-expect-error reason is one of four gateway values, not any string
    state: { status: "cancelled", reason: "nope", completedAt: "2026-01-01T00:00:00Z" },
};

// @ts-expect-error createdBySubject is required — the gateway always sends it
export const turnWithoutSubject: TfyTurn = {
    id: "turn-1",
    sessionId: "session-1",
    state: { status: "running" },
    createdAt: "2026-01-01T00:00:00Z",
};

declare const doneTurn: Extract<TfyTurn["state"], { status: "done" }>;

// `output` is the gateway's model message; on the runtime base this is `unknown`
// and would not permit a property access at all.
export const doneFinishReason: TfyFinishReason | null | undefined =
    doneTurn.output?.finishReason;
export const doneTokens: number | undefined = doneTurn.output?.usage?.inputTokens;

// ---------------------------------------------------------------------------
// Session / request params — gateway-only fields reach the server methods.
// ---------------------------------------------------------------------------

export const sessionSubject: TfySubject = hostSession.createdBySubject;

export const withMetadata: Parameters<DefaultServer["createSession"]>[0] = {
    agentName: "agent",
    tfyMetadata: JSON.stringify({ tenant: "acme" }),
};

export const withEndTimestamp: NonNullable<
    Parameters<DefaultServer["listSessions"]>[0]
> = {
    startTimestamp: "2026-01-01T00:00:00Z",
    endTimestamp: "2026-02-01T00:00:00Z",
};

export const savedAgent: TfyAgentSpec = {
    model: { name: "openai-main/gpt-4.1" },
    description: "Demo",
    metadataTags: { env: "test" },
    collaborators: [{ subject: "team:everyone", roleId: "agent-access" }],
    variables: { city: "Berlin" },
};

export const saveResult: TfySaveAgentResult = {
    agentId: "ag_1",
    versionId: "ver_1",
};
