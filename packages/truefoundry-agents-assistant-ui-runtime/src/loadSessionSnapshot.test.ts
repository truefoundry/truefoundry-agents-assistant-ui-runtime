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
        buildSnapshotFromSessionEventsPage: vi.fn(),
    };
});

import { buildSnapshotFromSessionEventsPage } from "./convertTurnMessages.js";
import { loadSessionSnapshot } from "./loadSessionSnapshot.js";
import { getSession } from "./sessions.js";

const mockClient = {} as AgentSessionClient;

const emptyPageResult = {
    snapshot: createEmptySessionSnapshot(),
    chronologicalItems: [],
    nextPageToken: undefined,
    hasMore: false,
};

describe("loadSessionSnapshot", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deduplicates concurrent loads for the same session", async () => {
        vi.mocked(getSession).mockResolvedValue({} as never);
        vi.mocked(buildSnapshotFromSessionEventsPage).mockResolvedValue(emptyPageResult);

        const [first, second] = await Promise.all([
            loadSessionSnapshot(mockClient, "session-1"),
            loadSessionSnapshot(mockClient, "session-1"),
        ]);

        expect(first).toBe(second);
        expect(getSession).toHaveBeenCalledTimes(1);
        expect(buildSnapshotFromSessionEventsPage).toHaveBeenCalledTimes(1);
    });

    it("allows a new load after the previous one settles", async () => {
        vi.mocked(getSession).mockResolvedValue({} as never);
        vi.mocked(buildSnapshotFromSessionEventsPage).mockResolvedValue(emptyPageResult);

        await loadSessionSnapshot(mockClient, "session-1");
        await loadSessionSnapshot(mockClient, "session-1");

        expect(getSession).toHaveBeenCalledTimes(2);
        expect(buildSnapshotFromSessionEventsPage).toHaveBeenCalledTimes(2);
    });

    it("forwards onProgress and historyPageSize to buildSnapshotFromSessionEventsPage", async () => {
        vi.mocked(getSession).mockResolvedValue({} as never);
        vi.mocked(buildSnapshotFromSessionEventsPage).mockResolvedValue(emptyPageResult);

        const onProgress = vi.fn();
        await loadSessionSnapshot(
            mockClient,
            "session-1",
            { historyPageSize: 25 },
            onProgress,
        );

        expect(buildSnapshotFromSessionEventsPage).toHaveBeenCalledWith(
            {},
            { limit: 25, onProgress },
        );
    });
});
