import type { AgentSpec } from "../server/types.js";

export type { AgentSpec } from "../server/types.js";

/** @deprecated Use Session with isMutable: true instead. Kept for title helper. */
export type DraftSession = {
    title?: string | null;
    agentSpec: AgentSpec;
};

export type AgentSpecUpdate = {
    instructions?: string;
    model?: Partial<AgentSpec["model"]> & {
        params?: Partial<NonNullable<AgentSpec["model"]["params"]>>;
    };
    mcpServers?: AgentSpec["mcpServers"];
    skills?: AgentSpec["skills"];
    messages?: AgentSpec["messages"];
    variables?: AgentSpec["variables"];
    responseFormat?: AgentSpec["responseFormat"];
    config?: AgentSpec["config"];
};

export function mergeAgentSpec(base: AgentSpec, update: AgentSpecUpdate): AgentSpec {
    const { model: modelUpdate, ...rest } = update;

    const next: AgentSpec = {
        ...base,
        ...rest,
    };

    if (modelUpdate != null) {
        next.model = {
            ...base.model,
            ...modelUpdate,
            name: modelUpdate.name ?? base.model.name,
            params:
                modelUpdate.params != null
                    ? { ...base.model.params, ...modelUpdate.params }
                    : base.model.params,
        };
    }

    return next;
}

export function draftSessionTitle(draft: DraftSession): string {
    return draft.title ?? draft.agentSpec.model.name;
}
