import "@testing-library/jest-dom/vitest";

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
