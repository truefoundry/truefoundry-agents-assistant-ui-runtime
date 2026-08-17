import { describe, expect, it } from "vitest";

import {
    buildMetadataMap,
    getEffortOptions,
    reasoningEffortsForModel,
    showsReasoningEffort,
    type ModelMetadata,
} from "./modelReasoningEffort.js";
import {
    enrichModelsWithReasoningEfforts,
    type TfyModelSelectorEntry,
} from "./cp.js";

const thinkingMeta: ModelMetadata = {
    thinking: true,
    removeParams: ["temperature"],
    params: [
        {
            key: "reasoning_effort",
            type: "string",
            defaultValue: "high",
            supportedValues: ["low", "medium", "high", "max"],
        },
    ],
};

const thinkingViaProviderDefaults: ModelMetadata = {
    thinking: true,
    params: [{ key: "max_tokens", maxValue: 128000 }],
    defaultProviderParams: {
        params: [
            {
                key: "reasoning_effort",
                type: "string",
                defaultValue: "high",
                supportedValues: ["low", "medium", "high", "xhigh", "max"],
            },
        ],
    },
};

describe("showsReasoningEffort", () => {
    it("hides for openai exact slug even when thinking", () => {
        expect(showsReasoningEffort(thinkingMeta, "openai")).toBe(false);
    });

    it("shows for azure-openai / anthropic when thinking", () => {
        expect(showsReasoningEffort(thinkingMeta, "azure-openai")).toBe(true);
        expect(showsReasoningEffort(thinkingMeta, "anthropic")).toBe(true);
    });

    it("hides when thinking is off or reasoning_effort is removed", () => {
        expect(
            showsReasoningEffort({ thinking: false }, "anthropic"),
        ).toBe(false);
        expect(
            showsReasoningEffort(
                { thinking: true, removeParams: ["reasoning_effort"] },
                "anthropic",
            ),
        ).toBe(false);
    });
});

describe("getEffortOptions / reasoningEffortsForModel", () => {
    it("uses supportedValues from model params", () => {
        expect(getEffortOptions(thinkingMeta)).toEqual([
            "low",
            "medium",
            "high",
            "max",
        ]);
        expect(reasoningEffortsForModel(thinkingMeta, "anthropic")).toEqual([
            "low",
            "medium",
            "high",
            "max",
        ]);
    });

    it("falls back to defaultProviderParams", () => {
        expect(getEffortOptions(thinkingViaProviderDefaults)).toEqual([
            "low",
            "medium",
            "high",
            "xhigh",
            "max",
        ]);
    });

    it("returns undefined when the picker should stay hidden", () => {
        expect(reasoningEffortsForModel(thinkingMeta, "openai")).toBeUndefined();
        expect(
            reasoningEffortsForModel({ thinking: false }, "anthropic"),
        ).toBeUndefined();
    });
});

describe("buildMetadataMap + enrichModelsWithReasoningEfforts", () => {
    const providersPayload = [
        {
            type: "provider-account/anthropic",
            integrations: [
                {
                    metadata: {
                        "claude-sonnet-4-6": thinkingMeta,
                        "claude-haiku": { thinking: false },
                    },
                },
            ],
        },
        {
            type: "provider-account/openai",
            integrations: [
                {
                    metadata: {
                        "o3-mini": thinkingMeta,
                    },
                },
            ],
        },
    ];

    it("indexes metadata by providerSlug/modelId", () => {
        const map = buildMetadataMap(providersPayload);
        expect(map.get("anthropic/claude-sonnet-4-6")).toEqual(thinkingMeta);
        expect(map.get("openai/o3-mini")).toEqual(thinkingMeta);
    });

    it("attaches properties.reasoningEfforts for thinking models only", () => {
        const models: TfyModelSelectorEntry[] = [
            {
                id: "anthropic-prod/claude-sonnet-4-6",
                name: "anthropic-prod/claude-sonnet-4-6",
                provider: { name: "anthropic" },
                properties: {},
                apiModel: "anthropic-prod/claude-sonnet-4-6",
                modelId: "claude-sonnet-4-6",
            },
            {
                id: "anthropic-prod/claude-haiku",
                name: "anthropic-prod/claude-haiku",
                provider: { name: "anthropic" },
                properties: {},
                apiModel: "anthropic-prod/claude-haiku",
                modelId: "claude-haiku",
            },
            {
                id: "openai-main/o3-mini",
                name: "openai-main/o3-mini",
                provider: { name: "openai" },
                properties: {},
                apiModel: "openai-main/o3-mini",
                modelId: "o3-mini",
            },
        ];

        const next = enrichModelsWithReasoningEfforts(models, providersPayload);

        expect(next[0]?.properties.reasoningEfforts).toEqual([
            "low",
            "medium",
            "high",
            "max",
        ]);
        expect(next[1]?.properties.reasoningEfforts).toBeUndefined();
        // exact openai slug hides even when thinking metadata exists
        expect(next[2]?.properties.reasoningEfforts).toBeUndefined();
    });
});
