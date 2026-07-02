import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { vi } from "vitest";

vi.mock("@openuidev/react-lang", () => ({
    Renderer: ({
        response,
        isStreaming,
    }: {
        response: string;
        isStreaming?: boolean;
    }) =>
        createElement(
            "div",
            {
                "data-testid": "openui-renderer",
                "data-streaming": String(!!isStreaming),
            },
            response,
        ),
}));

vi.mock("@openuidev/react-ui/genui-lib", () => ({
    openuiLibrary: {},
}));

// jsdom does not implement ResizeObserver; assistant-ui's viewport/scroll
// tracking primitives use it, so tests need a no-op stand-in.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
