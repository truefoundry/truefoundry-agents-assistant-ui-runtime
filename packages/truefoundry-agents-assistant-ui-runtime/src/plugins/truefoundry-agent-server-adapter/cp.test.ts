import { afterEach, describe, expect, it, vi } from "vitest";

import {
    agentSpecFromCpManifest,
    buildSaveAgentManifest,
    enrichModelsWithReasoningEfforts,
    mcpToolsPath,
    normalizeAgents,
    normalizeAgentSkills,
    normalizeEnabledModels,
    normalizeMcpServers,
    normalizeMcpTools,
    resolveGatewayURL,
    saveAgent,
    saveAgentResultFromCp,
    SAVE_AGENT_COLLABORATORS,
    SAVE_AGENT_TAGS,
    toCamelCaseDeep,
    toSnakeCaseDeep,
} from "./cp.js";
import { createTrueFoundryAgentUIServer } from "./createTrueFoundryAgentUIServer.js";

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
                id: "openai-main/gpt-4.1",
                name: "openai-main/gpt-4.1",
                provider: { name: "openai" },
                properties: {},
                apiModel: "openai-main/gpt-4.1",
                modelId: "gpt-4.1",
                providerAccount: "openai-main",
            },
            {
                id: "anthropic-prod/claude-sonnet-4-6",
                name: "anthropic-prod/claude-sonnet-4-6",
                provider: { name: "anthropic" },
                properties: {},
                apiModel: "anthropic-prod/claude-sonnet-4-6",
                modelId: "claude-sonnet-4-6",
                providerAccount: "anthropic-prod",
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
                id: "virtual-main/router",
                name: "virtual-main/router",
                provider: { name: "virtual-model" },
                properties: {},
                apiModel: "virtual-main/router",
                modelId: "router",
                providerAccount: "virtual-main",
            },
        ]);
    });

    it("returns [] for empty object", () => {
        expect(normalizeEnabledModels({})).toEqual([]);
    });

    it("adds optional limits and per-million-token costs from provider metadata", () => {
        const models = normalizeEnabledModels({
            anthropic: {
                main: [
                    {
                        provider: "anthropic",
                        model_id: "claude-sonnet",
                        model_fqn: "main/claude-sonnet",
                    },
                ],
            },
        });

        expect(
            enrichModelsWithReasoningEfforts(models, {
                data: [
                    {
                        type: "provider-account/anthropic",
                        integrations: [
                            {
                                metadata: {
                                    "claude-sonnet": {
                                        limits: {
                                            context_window: 200_000,
                                            max_output_tokens: 8_192,
                                        },
                                        pricing: {
                                            input_cost_per_million_tokens: 3,
                                            output_cost_per_million_tokens: 15,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            }),
        ).toEqual([
            expect.objectContaining({
                properties: {
                    contextLength: 200_000,
                    maxOutputTokens: 8_192,
                    inputCostPerMillionTokens: 3,
                    outputCostPerMillionTokens: 15,
                },
            }),
        ]);
    });

    it("drops malformed optional model metadata", () => {
        const models = normalizeEnabledModels({
            openai: {
                main: [
                    {
                        provider: "openai",
                        model_id: "gpt",
                        model_fqn: "main/gpt",
                    },
                ],
            },
        });

        expect(
            enrichModelsWithReasoningEfforts(models, {
                data: [
                    {
                        type: "provider-account/openai",
                        integrations: [
                            {
                                metadata: {
                                    gpt: {
                                        limits: {
                                            context_window: "large",
                                            max_output_tokens: -1,
                                        },
                                        cost: {
                                            input: Number.POSITIVE_INFINITY,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            }),
        ).toEqual(models);
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

describe("normalizeMcpTools", () => {
    it("normalizes valid rows, falls back id to name, and dedupes", () => {
        expect(
            normalizeMcpTools({
                data: [
                    { id: "tool_1", name: "search", description: "Search" },
                    { name: "read" },
                    { id: "duplicate", name: "search" },
                    { id: "missing-name" },
                ],
            }),
        ).toEqual([
            { id: "tool_1", name: "search", description: "Search" },
            { id: "read", name: "read" },
        ]);
    });

    it("accepts array and tools-wrapped responses", () => {
        expect(normalizeMcpTools([{ name: "array-tool" }])).toEqual([
            { id: "array-tool", name: "array-tool" },
        ]);
        expect(normalizeMcpTools({ tools: [{ name: "wrapped-tool" }] })).toEqual([
            { id: "wrapped-tool", name: "wrapped-tool" },
        ]);
    });
});

describe("createTrueFoundryAgentUIServer getMcpTools", () => {
    it("wires the encoded connector id to the CP tools endpoint", async () => {
        const fetchMock = vi.fn(async () =>
            Response.json({ data: [{ name: "list_repositories" }] }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const server = await createTrueFoundryAgentUIServer({
            apiKey: "key",
            cpURL: "https://cp.example/",
            gatewayURL: "https://gateway.example/acme",
        });
        const getMcpTools = server.getMcpTools;
        if (getMcpTools == null) {
            throw new Error("Expected TrueFoundry server to provide getMcpTools");
        }

        await expect(
            getMcpTools({ connectorId: "mcp/github enterprise" }),
        ).resolves.toEqual([
            { id: "list_repositories", name: "list_repositories" },
        ]);
        expect(mcpToolsPath("mcp/github enterprise")).toBe(
            "/api/svc/v1/mcp-servers/mcp%2Fgithub%20enterprise/tools",
        );
        expect(fetchMock).toHaveBeenCalledWith(
            "https://cp.example/api/svc/v1/mcp-servers/mcp%2Fgithub%20enterprise/tools",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer key",
                }),
            }),
        );
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
                                config: {
                                    iteration_limit: 50,
                                    ask_user_questions: { enabled: true },
                                },
                                skills: [
                                    {
                                        type: "truefoundry-skills-registry",
                                        fqn: "agent-skill:tfy/skills/web:1",
                                        preload: true,
                                        config: { timeout_ms: 1000 },
                                    },
                                ],
                                mcp_servers: [
                                    {
                                        name: "gmail",
                                        enable_tools: ["@read-only"],
                                        preload: true,
                                        config: { locale: "en" },
                                    },
                                ],
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
                    config: {
                        iterationLimit: 50,
                        askUserQuestions: { enabled: true },
                    },
                    skills: [
                        {
                            id: "agent-skill:tfy/skills/web:1",
                            name: "agent-skill:tfy/skills/web:1",
                            preload: true,
                            config: { timeoutMs: 1000 },
                        },
                    ],
                    mcpServers: [
                        {
                            id: "gmail",
                            name: "gmail",
                            enableTools: ["@read-only"],
                            preload: true,
                            config: { locale: "en" },
                        },
                    ],
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

    it("preserves mount runtime fields and agent config for Edit → Save", () => {
        const spec = agentSpecFromCpManifest({
            type: "truefoundry-agent",
            name: "saved",
            model: { name: "openai-main/gpt-4.1" },
            config: { iteration_limit: 25 },
            skills: [
                {
                    type: "truefoundry-skills-registry",
                    fqn: "agent-skill:tfy/skills/web:1",
                    preload: false,
                },
            ],
            mcp_servers: [
                {
                    name: "gmail",
                    enable_tools: ["@read-only"],
                    preload: true,
                },
            ],
        });

        expect(spec).toEqual({
            model: { name: "openai-main/gpt-4.1" },
            config: { iterationLimit: 25 },
            skills: [
                {
                    id: "agent-skill:tfy/skills/web:1",
                    name: "agent-skill:tfy/skills/web:1",
                    preload: false,
                },
            ],
            mcpServers: [
                {
                    id: "gmail",
                    name: "gmail",
                    enableTools: ["@read-only"],
                    preload: true,
                },
            ],
        });

        const saved = buildSaveAgentManifest("saved", spec!);
        expect(saved.config).toEqual({ iteration_limit: 25 });
        expect(saved.mcp_servers).toEqual([
            {
                type: "truefoundry-mcp-registry",
                name: "gmail",
                enable_tools: ["@read-only"],
                preload: true,
            },
        ]);
        expect(saved.skills).toEqual([
            {
                type: "truefoundry-skills-registry",
                fqn: "agent-skill:tfy/skills/web:1",
                preload: false,
            },
        ]);
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
    it("spreads the snake-cased spec and defaults missing tags / collaborators", () => {
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
            tags: { ...SAVE_AGENT_TAGS },
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

    it("keeps host tags, collaborators, and extra spec fields", () => {
        const manifest = buildSaveAgentManifest("named", {
            model: {
                name: "openai-main/gpt-4.1",
                params: { maxTokens: 4096, temperature: 0.2 },
            },
            description: "My agent",
            instructions: "Be concise",
            variables: { city: "Berlin" },
            messages: [{ role: "user", content: "Hello {{city}}" }],
            responseFormat: {
                type: "json_schema",
                jsonSchema: { name: "answer", schema: { type: "object" } },
            },
            tags: { env: "test", owner: "platform" },
            collaborators: [
                { subject: "user:ada@example.com", roleId: "agent-manager" },
            ],
        } as never);

        expect(manifest.description).toBe("My agent");
        expect(manifest.tags).toEqual({ env: "test", owner: "platform" });
        expect(manifest.collaborators).toEqual([
            { subject: "user:ada@example.com", role_id: "agent-manager" },
        ]);
        expect(manifest.variables).toEqual({ city: "Berlin" });
        expect(manifest.messages).toEqual([
            { role: "user", content: "Hello {{city}}" },
        ]);
        expect(manifest.response_format).toEqual({
            type: "json_schema",
            json_schema: { name: "answer", schema: { type: "object" } },
        });
        expect(manifest.model).toEqual({
            name: "openai-main/gpt-4.1",
            params: { max_tokens: 4096, temperature: 0.2 },
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
            Response.json({ data: { id: "ag_1", name: "my-agent" } }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const result = await saveAgent(
            { apiKey: "key", cpURL: "https://cp.example/" },
            {
                agentName: "my-agent",
                agentSpec: { model: { name: "openai-main/gpt-4.1" } },
                intent: "create",
            },
        );

        expect(result).toEqual({ agentId: "ag_1" });
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
        const [, init] = fetchMock.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ];
        const body = JSON.parse(String(init.body));
        expect(body.manifest.type).toBe("truefoundry-agent");
        expect(body.manifest.name).toBe("my-agent");
        expect(body.manifest.model).toEqual({ name: "openai-main/gpt-4.1" });
        expect(body.manifest.tags).toEqual(SAVE_AGENT_TAGS);
        expect(body.manifest.collaborators).toEqual([...SAVE_AGENT_COLLABORATORS]);
    });

    it("extracts agentId and versionId from a wrapped CP version response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                Response.json({
                    data: { id: "ver_9", agentId: "ag_1", name: "my-agent" },
                }),
            ),
        );

        const result = await saveAgent(
            { apiKey: "key", cpURL: "https://cp.example/" },
            {
                agentName: "my-agent",
                agentSpec: { model: { name: "openai-main/gpt-4.1" } },
                intent: "update",
            },
        );

        expect(result).toEqual({ agentId: "ag_1", versionId: "ver_9" });
    });
});

describe("saveAgentResultFromCp", () => {
    it("reads { data: { id, name } } (no agentId) as the agent itself", () => {
        expect(
            saveAgentResultFromCp({ data: { id: "ag_1", name: "my-agent" } }),
        ).toEqual({ agentId: "ag_1" });
    });

    it("reads { data: { id, agentId } } as version + agent", () => {
        expect(
            saveAgentResultFromCp({ data: { id: "ver_1", agentId: "ag_2" } }),
        ).toEqual({ agentId: "ag_2", versionId: "ver_1" });
    });

    it("returns {} for malformed payloads", () => {
        expect(saveAgentResultFromCp(null)).toEqual({});
        expect(saveAgentResultFromCp({ id: "not-wrapped" })).toEqual({});
    });
});

describe("old saved-agent manifest round-trip", () => {
    const oldManifest = {
        type: "truefoundry-agent",
        name: "ask-ai-agent",
        description: "Answer questions",
        model: {
            name: "openai-main/gpt-4.1",
            params: { max_tokens: 8192, reasoning_effort: "medium" },
        },
        instructions: "Be helpful",
        // Variable names are user keys — `my_city` must never become `myCity`.
        variables: {
            city: "Berlin",
            my_city: { default_value: "Pune", description: "home town" },
        },
        messages: [{ role: "user", content: "Hello {{city}}" }],
        // Uppercase tag keys are the regression case: snake-casing them once
        // produced "_t_f_y__a_l_p_h_a__…" on the wire.
        tags: {
            env: "prod",
            owner: "platform",
            TFY_ALPHA_ENABLE_OPENUI: "true",
        },
        collaborators: [
            { subject: "team:everyone", role_id: "agent-access" },
        ],
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "answer",
                // Schema property names are user data — `user_name` must
                // survive both directions verbatim.
                schema: {
                    type: "object",
                    properties: { user_name: { type: "string" } },
                },
            },
        },
        config: {
            iteration_limit: 50,
            ask_user_questions: { enabled: true },
            sandbox: { enabled: true, file_downloads: true },
        },
        mcp_servers: [
            {
                type: "truefoundry-mcp-registry",
                name: "gmail",
                enable_tools: ["@read-only"],
                preload: true,
            },
        ],
        skills: [
            {
                type: "truefoundry-skills-registry",
                fqn: "agent-skill:tfy/skills/web:1",
                preload: false,
            },
        ],
    };

    it("reads snake_case fields into camelCase spec and writes them back", () => {
        const spec = agentSpecFromCpManifest(oldManifest);
        expect(spec?.description).toBe("Answer questions");
        // User keys verbatim; `{ default_value }` records collapse to strings.
        expect(spec?.variables).toEqual({ city: "Berlin", my_city: "Pune" });
        expect(spec?.messages).toEqual([
            { role: "user", content: "Hello {{city}}" },
        ]);
        expect(spec?.tags).toEqual({
            env: "prod",
            owner: "platform",
            TFY_ALPHA_ENABLE_OPENUI: "true",
        });
        expect(spec?.collaborators).toEqual([
            { subject: "team:everyone", roleId: "agent-access" },
        ]);
        expect(spec?.responseFormat).toEqual({
            type: "json_schema",
            jsonSchema: {
                name: "answer",
                schema: {
                    type: "object",
                    properties: { user_name: { type: "string" } },
                },
            },
        });
        expect(spec?.model.params).toEqual({
            maxTokens: 8192,
            reasoningEffort: "medium",
        });
        expect(spec?.config).toEqual({
            iterationLimit: 50,
            askUserQuestions: { enabled: true },
            sandbox: { enabled: true, fileDownloads: true },
        });

        const saved = buildSaveAgentManifest("ask-ai-agent", spec!);
        expect(saved.description).toBe("Answer questions");
        expect(saved.variables).toEqual({ city: "Berlin", my_city: "Pune" });
        expect(saved.messages).toEqual([
            { role: "user", content: "Hello {{city}}" },
        ]);
        expect(saved.tags).toEqual({
            env: "prod",
            owner: "platform",
            TFY_ALPHA_ENABLE_OPENUI: "true",
        });
        expect(saved.collaborators).toEqual([
            { subject: "team:everyone", role_id: "agent-access" },
        ]);
        expect(saved.response_format).toEqual({
            type: "json_schema",
            json_schema: {
                name: "answer",
                schema: {
                    type: "object",
                    properties: { user_name: { type: "string" } },
                },
            },
        });
        expect(saved.model).toEqual({
            name: "openai-main/gpt-4.1",
            params: { max_tokens: 8192, reasoning_effort: "medium" },
        });
        expect(saved.config).toEqual({
            iteration_limit: 50,
            ask_user_questions: { enabled: true },
            sandbox: { enabled: true, file_downloads: true },
        });
        expect(saved.mcp_servers).toEqual([
            {
                type: "truefoundry-mcp-registry",
                name: "gmail",
                enable_tools: ["@read-only"],
                preload: true,
            },
        ]);
        expect(saved.skills).toEqual([
            {
                type: "truefoundry-skills-registry",
                fqn: "agent-skill:tfy/skills/web:1",
                preload: false,
            },
        ]);
    });
});
