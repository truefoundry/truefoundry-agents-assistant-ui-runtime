import type { AgentBuilderServer } from "../../server/types.js";
import {
    listAgents,
    listAgentSkills,
    listEnabledModels,
    listMcpServers,
    resolveGatewayURL,
    saveAgent,
    type TfyAgentSelectorEntry,
    type TfyConnectorSelectorEntry,
    type TfyModelSelectorEntry,
    type TfySkillSelectorEntry,
} from "./cp.js";
import {
    createTrueFoundryChatServer,
    type TrueFoundryChatServer,
} from "./chatServer.js";
import type { TfyAgentSpec } from "./types.js";

export type CreateTrueFoundryAgentUIServerOptions = {
    apiKey: string;
    /** Control Plane base URL (builder lists + optional /session for gateway resolve). */
    cpURL: string;
    /**
     * Gateway base URL. When omitted, resolved via
     * `GET {cpURL}/api/svc/v1/session` → `{cpURL}{env.LLM_GATEWAY_URL ?? "/api/llm"}/{tenantName}`.
     * Session failure throws (no silent public-gateway fallback).
     */
    gatewayURL?: string;
};

export type TrueFoundryAgentUIServer<TSpec extends TfyAgentSpec = TfyAgentSpec> =
    TrueFoundryChatServer<TSpec> &
        AgentBuilderServer<
            TSpec,
            TfyModelSelectorEntry,
            TfySkillSelectorEntry,
            TfyConnectorSelectorEntry,
            TfyAgentSelectorEntry,
            unknown
        >;

function credentialsKey(opts: CreateTrueFoundryAgentUIServerOptions): string {
    return `${opts.apiKey}\0${opts.cpURL}\0${opts.gatewayURL ?? ""}`;
}

const inflight = new Map<
    string,
    Promise<TrueFoundryAgentUIServer<TfyAgentSpec>>
>();

/**
 * Full pack: gateway chat + Control Plane builder lists.
 *
 * Same `apiKey` bearer is used for CP and gateway. Concurrent calls with the
 * same credentials share one in-flight promise (React Strict Mode safe).
 */
export async function createTrueFoundryAgentUIServer<
    TSpec extends TfyAgentSpec = TfyAgentSpec,
>(
    opts: CreateTrueFoundryAgentUIServerOptions,
): Promise<TrueFoundryAgentUIServer<TSpec>> {
    const key = credentialsKey(opts);
    const existing = inflight.get(key);
    if (existing != null) {
        return existing as Promise<TrueFoundryAgentUIServer<TSpec>>;
    }

    const promise = (async () => {
        const baseUrl = await resolveGatewayURL(opts);
        const chat = createTrueFoundryChatServer<TSpec>({
            apiKey: opts.apiKey,
            baseUrl,
        });
        const cp = { apiKey: opts.apiKey, cpURL: opts.cpURL };

        const server: TrueFoundryAgentUIServer<TSpec> = {
            ...chat,
            getModels: () => listEnabledModels(cp),
            getSkills: () => listAgentSkills(cp),
            getMcp: () => listMcpServers(cp),
            searchAgents: (req) => listAgents(cp, req),
            saveAgent: (req) => saveAgent(cp, req),
        };
        return server as TrueFoundryAgentUIServer<TfyAgentSpec>;
    })();

    inflight.set(key, promise);
    try {
        return (await promise) as TrueFoundryAgentUIServer<TSpec>;
    } finally {
        inflight.delete(key);
    }
}
