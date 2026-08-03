import { describe, expect, it } from "vitest";
import {
    getTfyMcpInitServers,
    getTfyThreadState,
    getTfyUsage,
    isTfyMcpToolInfo,
    isTfySystemToolInfo,
    isTfyToolInfo,
} from "./guards.js";

const usage = {
    inputTokens: 10,
    outputTokens: 5,
    inputTokensBreakdown: {
        harness: 1,
        skills: 2,
        instructions: 3,
        toolDefinitions: 4,
        messages: 5,
    },
};

describe("tool info", () => {
    it("discriminates on type", () => {
        const system = { type: "truefoundry-system", name: "ask_user_question" };
        const mcp = {
            type: "mcp",
            name: "search",
            serverId: "s1",
            serverName: "github",
        };

        expect(isTfySystemToolInfo(system)).toBe(true);
        expect(isTfyMcpToolInfo(system)).toBe(false);
        expect(isTfyMcpToolInfo(mcp)).toBe(true);
        expect(isTfySystemToolInfo(mcp)).toBe(false);
        expect(isTfyToolInfo(system) && isTfyToolInfo(mcp)).toBe(true);
    });

    it("rejects an mcp shape missing its server attribution", () => {
        expect(isTfyMcpToolInfo({ type: "mcp", name: "search" })).toBe(false);
    });

    it("rejects absent and non-object values", () => {
        for (const value of [undefined, null, "mcp", 0, []]) {
            expect(isTfyToolInfo(value)).toBe(false);
        }
    });
});

describe("getTfyUsage", () => {
    it("returns usage with its breakdown intact", () => {
        expect(getTfyUsage({ usage })).toEqual(usage);
    });

    it("rejects usage whose breakdown is absent or incomplete", () => {
        expect(getTfyUsage({ usage: { inputTokens: 1, outputTokens: 2 } })).toBeUndefined();
        expect(
            getTfyUsage({
                usage: { ...usage, inputTokensBreakdown: { harness: 1 } },
            }),
        ).toBeUndefined();
    });

    it("returns undefined when there is no usage at all", () => {
        expect(getTfyUsage({})).toBeUndefined();
        expect(getTfyUsage(undefined)).toBeUndefined();
    });
});

describe("getTfyThreadState", () => {
    it("accepts done with output and error with a message", () => {
        const done = { status: "done", output: { type: "model.message" } };
        const errored = { status: "error", error: "boom" };

        expect(getTfyThreadState({ state: done })).toEqual(done);
        expect(getTfyThreadState({ state: errored })).toEqual(errored);
    });

    it("rejects done without output, since the gateway always sends one", () => {
        expect(getTfyThreadState({ state: { status: "done" } })).toBeUndefined();
    });

    it("rejects an unknown status", () => {
        expect(getTfyThreadState({ state: { status: "running" } })).toBeUndefined();
        expect(getTfyThreadState({})).toBeUndefined();
    });
});

describe("getTfyMcpInitServers", () => {
    it("returns the servers when every entry is identifiable", () => {
        const servers = [
            { id: "a", name: "github", transportType: "http" },
            { id: "b", name: "slack" },
        ];
        expect(getTfyMcpInitServers({ mcpServers: servers })).toEqual(servers);
    });

    it("rejects the whole array if any entry is malformed", () => {
        expect(
            getTfyMcpInitServers({ mcpServers: [{ id: "a", name: "ok" }, { id: "b" }] }),
        ).toBeUndefined();
    });

    it("rejects a non-array", () => {
        expect(getTfyMcpInitServers({ mcpServers: {} })).toBeUndefined();
        expect(getTfyMcpInitServers({})).toBeUndefined();
    });

    it("accepts an empty list", () => {
        expect(getTfyMcpInitServers({ mcpServers: [] })).toEqual([]);
    });
});
