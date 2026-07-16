// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createTrueFoundryThreadHistoryProvider } from "./truefoundryThreadHistoryProvider.js";

describe("createTrueFoundryThreadHistoryProvider", () => {
    it("renders children synchronously on first commit", () => {
        const Provider = createTrueFoundryThreadHistoryProvider();
        const { getByText } = render(
            <Provider>
                <span>thread child</span>
            </Provider>,
        );
        expect(getByText("thread child")).toBeTruthy();
    });
});
