import { afterEach, describe, expect, it, vi } from "vitest";

import {
    agentSpecFromCpManifest,
    buildSaveAgentManifest,
    normalizeAgents,
    normalizeAgentSkills,
    normalizeEnabledModels,
    normalizeMcpServers,
    resolveGatewayURL,
    saveAgent,
    SAVE_AGENT_COLLABORATORS,
    SAVE_AGENT_METADATA_TAGS,
    toCamelCaseDeep,
    toSnakeCaseDeep,
} from "./cp.js";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("resolveGatewayURL", () => {
    it("short-circuits when gatewayURL is set (no fetch)", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const url = await resolveGatewayURL({
            apiKey: "key",
            cpURL: "https://cp.example",
            gatewayURL: "https://gateway.truefoundry.ai/acme",
        });

        expect(url).toBe("https://gateway.truefoundry.ai/acme");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("resolves via /session → {cpURL}{LLM_GATEWAY_URL}/{tenantName}", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                Response.json({
                    user: { tenantName: "truefoundry" },
                    env: {
                        TENANT_NAME: "truefoundry",
                        LLM_GATEWAY_URL: "/api/llm",
                    },
                }),
            ),
        );

        const url = await resolveGatewayURL({
            apiKey: "key",
            cpURL: "https://cp.example/",
        });

        expect(url).toBe("https://cp.example/api/llm/truefoundry");
        expect(fetch).toHaveBeenCalledWith(
            "https://cp.example/api/svc/v1/session",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer key",
                }),
            }),
        );
    });

    it("defaults llm prefix to /api/llm when env.LLM_GATEWAY_URL is absent", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                Response.json({
                    user: { tenantName: "acme" },
                }),
            ),
        );

        const url = await resolveGatewayURL({
            apiKey: "key",
            cpURL: "https://cp.example",
        });

        expect(url).toBe("https://cp.example/api/llm/acme");
    });

    it("throws on session HTTP failure (no public-gateway fallback)", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("nope", { status: 401 })),
        );

        await expect(
            resolveGatewayURL({
                apiKey: "key",
                cpURL: "https://cp.example",
            }),
        ).rejects.toThrow(/CP 401/);
    });

    it("throws when tenantName is missing", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json({ user: {}, env: {} })),
        );

        await expect(
            resolveGatewayURL({
                apiKey: "key",
                cpURL: "https://cp.example",
            }),
        ).rejects.toThrow(/tenantName/);
    });
});

describe("normalizeEnabledModels", () => {
    it("flattens nested provider → account → models", () => {
        const rows = normalizeEnabledModels({
            openai: {
                "openai-main": [
                    {
                        name: "gpt-4.1",
                        provider: "openai",
                        provider_account_name: "openai-main",
                        model_id: "gpt-4.1",
                        model_fqn: "openai-main/gpt-4.1",
                        types: ["chat"],
                    },
                ],
            },
            anthropic: {
                "anthropic-prod": [
                    {
                        name: "claude-sonnet-4-6",
                        provider: "anthropic",
                        provider_account_name: "anthropic-prod",
                        model_id: "claude-sonnet-4-6",
                        model_fqn: "anthropic-prod/claude-sonnet-4-6",
                        types: ["chat"],
                    },
                    {
                        name: "embed-only",
                        provider: "anthropic",
                        model_fqn: "anthropic-prod/embed",
                        types: ["embedding"],
                    },
                ],
            },
        });

        expect(rows).toEqual([
            {
                name: "gpt-4.1",
                provider: "openai",
                apiModel: "openai-main/gpt-4.1",
                modelId: "gpt-4.1",
                providerAccount: "openai-main",
                id: "openai-main/gpt-4.1",
            },
            {
                name: "claude-sonnet-4-6",
                provider: "anthropic",
                apiModel: "anthropic-prod/claude-sonnet-4-6",
                modelId: "claude-sonnet-4-6",
                providerAccount: "anthropic-prod",
                id: "anthropic-prod/claude-sonnet-4-6",
            },
        ]);
    });

    it("flattens virtual-model top-level account → models[]", () => {
        const rows = normalizeEnabledModels({
            "virtual-main": [
                {
                    name: "router",
                    provider: "virtual-model",
                    provider_account_name: "virtual-main",
                    model_id: "router",
                    model_fqn: "virtual-main/router",
                    types: ["chat"],
                },
            ],
        });

        expect(rows).toEqual([
            {
                name: "router",
                provider: "virtual-model",
                apiModel: "virtual-main/router",
                modelId: "router",
                providerAccount: "virtual-main",
                id: "virtual-main/router",
            },
        ]);
    });

    it("returns [] for empty object", () => {
        expect(normalizeEnabledModels({})).toEqual([]);
    });
});

describe("normalizeAgentSkills", () => {
    it("maps latest_version.fqn to id/fqn", () => {
        const rows = normalizeAgentSkills({
            data: [
                {
                    id: "sk_abc",
                    name: "web-search",
                    latest_version: {
                        id: "sv_1",
                        fqn: "agent-skill:truefoundry/skills/web-search:1",
                        manifest: {
                            source: { description: "Search the web" },
                        },
                    },
                },
                {
                    id: "sk_drop",
                    name: "no-version",
                },
            ],
        });

        expect(rows).toEqual([
            {
                id: "agent-skill:truefoundry/skills/web-search:1",
                name: "web-search",
                fqn: "agent-skill:truefoundry/skills/web-search:1",
                description: "Search the web",
            },
        ]);
    });
});

describe("normalizeMcpServers", () => {
    it("uses server name as id/mcpName and dedupes", () => {
        const rows = normalizeMcpServers({
            data: [
                {
                    id: "mcp_01",
                    name: "github",
                    manifest: { description: "GitHub MCP" },
                    authStatus: { status: "unauthenticated" },
                },
                {
                    id: "mcp_dup",
                    name: "github",
                    manifest: { description: "dup" },
                },
                {
                    id: "mcp_02",
                    name: "slack",
                    authStatus: { status: "authenticated" },
                },
            ],
        });

        expect(rows).toEqual([
            {
                id: "github",
                name: "github",
                mcpName: "github",
                description: "GitHub MCP",
                serverId: "mcp_01",
                authenticated: false,
            },
            {
                id: "slack",
                name: "slack",
                mcpName: "slack",
                serverId: "mcp_02",
                authenticated: true,
            },
        ]);
    });
});

describe("normalizeAgents", () => {
    it("maps name, agentId, and agentSpec from latestVersionDetails.manifest", () => {
        expect(
            normalizeAgents({
                data: [
                    {
                        id: "ag_1",
                        name: "ask-ai-agent",
                        latestVersionDetails: {
                            manifest: {
                                type: "truefoundry-agent",
                                name: "ask-ai-agent",
                                model: {
                                    name: "openai-main/gpt-4.1",
                                    params: {
                                        max_tokens: 8192,
                                        reasoning_effort: "medium",
                                    },
                                },
                                instructions: "Be helpful",
                                skills: [
                                    {
                                        type: "truefoundry-skills-registry",
                                        fqn: "agent-skill:tfy/skills/web:1",
                                    },
                                ],
                                mcp_servers: [{ name: "gmail" }],
                            },
                        },
                    },
                    { name: "" },
                    {},
                    {
                        name: "try-only",
                        // no manifest → Try still works; Edit hidden
                    },
                ],
            }),
        ).toEqual([
            {
                name: "ask-ai-agent",
                agentId: "ag_1",
                agentSpec: {
                    model: {
                        name: "openai-main/gpt-4.1",
                        params: { maxTokens: 8192, reasoningEffort: "medium" },
                    },
                    instructions: "Be helpful",
                    skills: [
                        {
                            id: "agent-skill:tfy/skills/web:1",
                            name: "agent-skill:tfy/skills/web:1",
                        },
                    ],
                    mcpServers: [{ id: "gmail", name: "gmail" }],
                },
            },
            { name: "try-only", agentId: "try-only" },
        ]);
    });
});

describe("toCamelCaseDeep", () => {
    it("converts nested snake_case keys", () => {
        expect(
            toCamelCaseDeep({
                max_tokens: 8192,
                reasoning_effort: "medium",
                nested: { iteration_limit: 50 },
            }),
        ).toEqual({
            maxTokens: 8192,
            reasoningEffort: "medium",
            nested: { iterationLimit: 50 },
        });
    });
});

describe("agentSpecFromCpManifest", () => {
    it("returns undefined when model.name is missing", () => {
        expect(agentSpecFromCpManifest({ type: "truefoundry-agent" })).toBeUndefined();
        expect(agentSpecFromCpManifest(null)).toBeUndefined();
    });
});

describe("toSnakeCaseDeep", () => {
    it("converts nested camelCase keys", () => {
        expect(
            toSnakeCaseDeep({
                maxTokens: 8192,
                reasoningEffort: "medium",
                nested: { iterationLimit: 50 },
            }),
        ).toEqual({
            max_tokens: 8192,
            reasoning_effort: "medium",
            nested: { iteration_limit: 50 },
        });
    });
});

describe("buildSaveAgentManifest", () => {
    it("hardcodes type / metadata_tags / collaborators and snake_cases spec fields", () => {
        const manifest = buildSaveAgentManifest("my-agent", {
            model: {
                name: "ai-foundry/claude-sonnet-4-6",
                params: { maxTokens: 8192, reasoningEffort: "medium" },
            },
            instructions: "Be helpful",
            config: {
                iterationLimit: 50,
                askUserQuestions: { enabled: true },
            } as never,
            mcpServers: [
                {
                    type: "truefoundry-mcp-registry",
                    name: "gmail",
                    enableTools: ["@read-only"],
                },
            ] as never[],
            skills: [
                {
                    type: "truefoundry-skills-registry",
                    fqn: "agent-skill:truefoundry/skills/web:1",
                    preload: true,
                },
            ] as never[],
        });

        expect(manifest).toEqual({
            type: "truefoundry-agent",
            name: "my-agent",
            description: "",
            model: {
                name: "ai-foundry/claude-sonnet-4-6",
                params: { max_tokens: 8192, reasoning_effort: "medium" },
            },
            metadata_tags: { ...SAVE_AGENT_METADATA_TAGS },
            collaborators: [...SAVE_AGENT_COLLABORATORS],
            instructions: "Be helpful",
            config: {
                iteration_limit: 50,
                ask_user_questions: { enabled: true },
            },
            mcp_servers: [
                {
                    type: "truefoundry-mcp-registry",
                    name: "gmail",
                    enable_tools: ["@read-only"],
                    preload: false,
                },
            ],
            skills: [
                {
                    type: "truefoundry-skills-registry",
                    fqn: "agent-skill:truefoundry/skills/web:1",
                    preload: true,
                },
            ],
        });
    });

    it("normalizes UI catalog mounts and defaults enable_tools / preload", () => {
        const manifest = buildSaveAgentManifest("draft-save", {
            model: { name: "openai-main/gpt-4.1" },
            mcpServers: [{ id: "gmail", name: "gmail" }] as never[],
            skills: [
                {
                    id: "agent-skill:truefoundry/skills/web:1",
                    name: "web",
                },
            ] as never[],
        });

        expect(manifest.mcp_servers).toEqual([
            {
                type: "truefoundry-mcp-registry",
                name: "gmail",
                enable_tools: ["@all"],
                preload: false,
            },
        ]);
        expect(manifest.skills).toEqual([
            {
                type: "truefoundry-skills-registry",
                fqn: "agent-skill:truefoundry/skills/web:1",
                preload: false,
            },
        ]);
        expect(manifest.description).toBe("");
        expect(manifest).not.toHaveProperty("instructions");
        expect(manifest).not.toHaveProperty("config");
    });

    it("passes through description when present on the spec", () => {
        const manifest = buildSaveAgentManifest("named", {
            model: { name: "openai-main/gpt-4.1" },
            description: "My agent",
        } as never);

        expect(manifest.description).toBe("My agent");
    });
});

describe("saveAgent", () => {
    it("PUTs { manifest } to /api/svc/v1/agents", async () => {
        const fetchMock = vi.fn(async () =>
            Response.json({ id: "ag_1", name: "my-agent" }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const result = await saveAgent(
            { apiKey: "key", cpURL: "https://cp.example/" },
            {
                agentName: "my-agent",
                agentSpec: { model: { name: "openai-main/gpt-4.1" } },
            },
        );

        expect(result).toEqual({ id: "ag_1", name: "my-agent" });
        expect(fetchMock).toHaveBeenCalledWith(
            "https://cp.example/api/svc/v1/agents",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    Authorization: "Bearer key",
                    Accept: "application/json",
                    "Content-Type": "application/json",
                }),
            }),
        );
        const body = JSON.parse(
            (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
        );
        expect(body.manifest.type).toBe("truefoundry-agent");
        expect(body.manifest.name).toBe("my-agent");
        expect(body.manifest.model).toEqual({ name: "openai-main/gpt-4.1" });
        expect(body.manifest.metadata_tags).toEqual(SAVE_AGENT_METADATA_TAGS);
        expect(body.manifest.collaborators).toEqual([...SAVE_AGENT_COLLABORATORS]);
    });
});
