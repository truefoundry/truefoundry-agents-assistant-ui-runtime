import type { AgentSessionClient } from "truefoundry-gateway-sdk/agents";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptySessionSnapshot } from "./sessionSnapshot.js";

vi.mock("./sessions.js", () => ({
    getSession: vi.fn(),
}));

vi.mock("./convertTurnMessages.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./convertTurnMessages.js")>();
    return {
        ...actual,
        buildSnapshotFromSessionEvents: vi.fn(),
    };
});

import { buildSnapshotFromSessionEvents } from "./convertTurnMessages.js";
import { loadSessionSnapshot } from "./loadSessionSnapshot.js";
import { getSession } from "./sessions.js";

const mockClient = {} as AgentSessionClient;

describe("loadSessionSnapshot", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deduplicates concurrent loads for the same session", async () => {
        vi.mocked(getSession).mockResolvedValue({} as never);
        vi.mocked(buildSnapshotFromSessionEvents).mockResolvedValue(
            createEmptySessionSnapshot(),
        );

        const [first, second] = await Promise.all([
            loadSessionSnapshot(mockClient, "session-1"),
            loadSessionSnapshot(mockClient, "session-1"),
        ]);

        expect(first).toBe(second);
        expect(getSession).toHaveBeenCalledTimes(1);
        expect(buildSnapshotFromSessionEvents).toHaveBeenCalledTimes(1);
    });

    it("allows a new load after the previous one settles", async () => {
        vi.mocked(getSession).mockResolvedValue({} as never);
        vi.mocked(buildSnapshotFromSessionEvents).mockResolvedValue(
            createEmptySessionSnapshot(),
        );

        await loadSessionSnapshot(mockClient, "session-1");
        await loadSessionSnapshot(mockClient, "session-1");

        expect(getSession).toHaveBeenCalledTimes(2);
        expect(buildSnapshotFromSessionEvents).toHaveBeenCalledTimes(2);
    });

    it("forwards onProgress to buildSnapshotFromSessionEvents", async () => {
        vi.mocked(getSession).mockResolvedValue({} as never);
        vi.mocked(buildSnapshotFromSessionEvents).mockResolvedValue(
            createEmptySessionSnapshot(),
        );

        const onProgress = vi.fn();
        await loadSessionSnapshot(mockClient, "session-1", undefined, onProgress);

        expect(buildSnapshotFromSessionEvents).toHaveBeenCalledWith(
            {},
            onProgress,
        );
    });
});
