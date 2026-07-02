// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";

import { RuntimeHarness } from "./RuntimeHarness.js";
import { ThreadContainer } from "./ThreadContainer.js";

function renderThread(
    messages: ThreadMessageLike[],
    options?: { isLoading?: boolean; composer?: React.ReactNode },
) {
    return render(
        <RuntimeHarness messages={messages} isLoading={options?.isLoading}>
            <ThreadContainer composer={options?.composer} />
        </RuntimeHarness>,
    );
}

describe("ThreadContainer", () => {
    it("renders the welcome screen for a new, empty thread", () => {
        renderThread([]);
        expect(screen.getByText("How can I help you today?")).toBeInTheDocument();
    });

    it("renders the loading skeleton while thread history is loading", () => {
        renderThread([], { isLoading: true });
        expect(screen.getByRole("status", { name: "Loading conversation" })).toBeInTheDocument();
        expect(screen.queryByText("How can I help you today?")).not.toBeInTheDocument();
    });

    it("renders the message list once loaded and non-empty", () => {
        renderThread([
            { role: "user", content: "hi" },
            { role: "assistant", content: "hello there" },
        ]);
        expect(screen.getByText("hello there")).toBeInTheDocument();
        expect(screen.queryByText("How can I help you today?")).not.toBeInTheDocument();
    });

    it("renders the supplied composer slot", () => {
        renderThread([{ role: "user", content: "hi" }], {
            composer: <div data-testid="composer-slot" />,
        });
        expect(screen.getByTestId("composer-slot")).toBeInTheDocument();
    });

    it("omits the composer area entirely while loading", () => {
        renderThread([], { isLoading: true, composer: <div data-testid="composer-slot" /> });
        expect(screen.queryByTestId("composer-slot")).not.toBeInTheDocument();
    });
});
