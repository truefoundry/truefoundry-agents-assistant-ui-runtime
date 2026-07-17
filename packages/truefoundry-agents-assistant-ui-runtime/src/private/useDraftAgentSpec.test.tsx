// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DraftSessionBridge } from "./draftSessionBridge.js";
import { useDraftAgentSpec } from "./useDraftAgentSpec.js";

const defaultAgentSpec = { model: { name: "anthropic/claude-sonnet-4-6" } };

async function flushMicrotasks() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("useDraftAgentSpec", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("stores updatedAt from sync and returns it once from takeTurnHeaderTimestamp", async () => {
        const syncAgentSpec = vi
            .fn()
            .mockResolvedValue("2026-06-30T12:00:00.000Z");
        const draftBridge: DraftSessionBridge = {
            getDraftAgentSpec: vi.fn().mockResolvedValue(defaultAgentSpec),
            syncAgentSpec,
        };

        const { result } = renderHook(() =>
            useDraftAgentSpec({
                draftSessionId: "draft-1",
                draftBridge,
                defaultAgentSpec,
            }),
        );

        await flushMicrotasks();
        expect(draftBridge.getDraftAgentSpec).toHaveBeenCalledWith("draft-1");

        act(() => {
            result.current.updateAgentSpec({ instructions: "be brief" });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(400);
        });
        await flushMicrotasks();

        expect(syncAgentSpec).toHaveBeenCalledOnce();

        let first: string | undefined;
        await act(async () => {
            first = await result.current.takeTurnHeaderTimestamp();
        });
        expect(first).toBe("2026-06-30T12:00:00.000Z");

        let second: string | undefined;
        await act(async () => {
            second = await result.current.takeTurnHeaderTimestamp();
        });
        expect(second).toBeUndefined();
    });

    it("flushes a pending debounced sync before returning the timestamp", async () => {
        const syncAgentSpec = vi
            .fn()
            .mockResolvedValue("2026-06-30T13:00:00.000Z");
        const draftBridge: DraftSessionBridge = {
            getDraftAgentSpec: vi.fn().mockResolvedValue(defaultAgentSpec),
            syncAgentSpec,
        };

        const { result } = renderHook(() =>
            useDraftAgentSpec({
                draftSessionId: "draft-1",
                draftBridge,
                defaultAgentSpec,
            }),
        );

        await flushMicrotasks();
        expect(draftBridge.getDraftAgentSpec).toHaveBeenCalledWith("draft-1");

        act(() => {
            result.current.updateAgentSpec({ instructions: "new" });
        });
        expect(syncAgentSpec).not.toHaveBeenCalled();

        let timestamp: string | undefined;
        await act(async () => {
            timestamp = await result.current.takeTurnHeaderTimestamp();
        });

        expect(syncAgentSpec).toHaveBeenCalledOnce();
        expect(timestamp).toBe("2026-06-30T13:00:00.000Z");
    });
});
