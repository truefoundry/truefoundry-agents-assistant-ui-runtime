"use client";

import type { AgentSpec } from "truefoundry-agents-assistant-ui-runtime";

import { EXAMPLE_MODEL_NAMES } from "@/lib/draft/defaultAgentSpec";

type ModelPickerProps = {
    model: AgentSpec["model"];
    disabled?: boolean;
    onChange: (model: AgentSpec["model"]) => void;
};

export function ModelPicker({ model, disabled, onChange }: ModelPickerProps) {
    return (
        <div className="space-y-2">
            <label className="text-muted-foreground block text-xs font-medium">
                Model
            </label>
            <select
                value={model.name}
                disabled={disabled}
                onChange={(event) =>
                    onChange({ ...model, name: event.target.value })
                }
                className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
            >
                {EXAMPLE_MODEL_NAMES.map((name) => (
                    <option key={name} value={name}>
                        {name}
                    </option>
                ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                    <span className="text-muted-foreground text-xs">Max tokens</span>
                    <input
                        type="number"
                        min={1}
                        disabled={disabled}
                        value={model.params?.maxTokens ?? ""}
                        onChange={(event) =>
                            onChange({
                                ...model,
                                params: {
                                    ...model.params,
                                    maxTokens: Number(event.target.value) || undefined,
                                },
                            })
                        }
                        className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-muted-foreground text-xs">Temperature</span>
                    <input
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        disabled={disabled}
                        value={model.params?.temperature ?? ""}
                        onChange={(event) =>
                            onChange({
                                ...model,
                                params: {
                                    ...model.params,
                                    temperature: Number(event.target.value),
                                },
                            })
                        }
                        className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-muted-foreground text-xs">Reasoning</span>
                    <select
                        disabled={disabled}
                        value={model.params?.reasoningEffort ?? "low"}
                        onChange={(event) =>
                            onChange({
                                ...model,
                                params: {
                                    ...model.params,
                                    reasoningEffort: event.target.value,
                                },
                            })
                        }
                        className="border-input bg-background w-full rounded-md border px-2 py-1 text-sm"
                    >
                        {["none", "minimal", "low", "medium", "high"].map((level) => (
                            <option key={level} value={level}>
                                {level}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    );
}
