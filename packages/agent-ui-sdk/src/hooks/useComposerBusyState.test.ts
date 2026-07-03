// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const useThreadIsRunning = vi.fn(() => false);

vi.mock("@assistant-ui/core/react", () => ({
    useThreadIsRunning: () => useThreadIsRunning(),
}));

import { ComposerBusyProvider, useComposerBusyState } from "./useComposerBusyState.js";

function wrapper({ children }: { children: ReactNode }) {
    return createElement(ComposerBusyProvider, null, children);
}

describe("useComposerBusyState", () => {
    beforeEach(() => {
        useThreadIsRunning.mockReturnValue(false);
    });

    it("starts busy immediately on send before the thread is running", () => {
        const { result } = renderHook(() => useComposerBusyState(), { wrapper });

        act(() => {
            result.current.send(() => undefined);
        });

        expect(result.current.isBusy).toBe(true);
        expect(result.current.isSubmitting).toBe(true);
        expect(result.current.isRunning).toBe(false);
    });

    it("clears submitting when the thread stops running", async () => {
        useThreadIsRunning.mockReturnValue(true);
        const { result, rerender } = renderHook(() => useComposerBusyState(), { wrapper });

        act(() => {
            result.current.send(() => undefined);
        });

        useThreadIsRunning.mockReturnValue(false);
        rerender();

        await waitFor(() => {
            expect(result.current.isBusy).toBe(false);
        });
    });

    it("clears submitting when send rejects", async () => {
        const { result } = renderHook(() => useComposerBusyState(), { wrapper });

        act(() => {
            result.current.send(() => Promise.reject(new Error("send failed")));
        });

        expect(result.current.isBusy).toBe(true);

        await waitFor(() => {
            expect(result.current.isBusy).toBe(false);
        });
    });

    it("resetBusy clears optimistic submitting state", () => {
        const { result } = renderHook(() => useComposerBusyState(), { wrapper });

        act(() => {
            result.current.send(() => undefined);
        });
        expect(result.current.isBusy).toBe(true);

        act(() => {
            result.current.resetBusy();
        });
        expect(result.current.isBusy).toBe(false);
    });
});
