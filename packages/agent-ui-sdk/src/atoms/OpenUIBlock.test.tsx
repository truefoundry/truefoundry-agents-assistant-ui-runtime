// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpenUIBlock } from "./OpenUIBlock.js";

describe("OpenUIBlock", () => {
    it("renders OpenUI source through Renderer", () => {
        render(<OpenUIBlock source={'Card() { title: "Hello" }'} />);
        expect(screen.getByTestId("openui-renderer")).toHaveTextContent('Card() { title: "Hello" }');
        expect(screen.getByTestId("openui-renderer")).toHaveAttribute("data-streaming", "false");
    });

    it("forwards isStreaming to Renderer", () => {
        render(<OpenUIBlock source="Card() {}" isStreaming />);
        expect(screen.getByTestId("openui-renderer")).toHaveAttribute("data-streaming", "true");
    });

    it("exposes a stable wrapper slot for integration tests", () => {
        render(<OpenUIBlock source="Card() {}" />);
        expect(screen.getByTestId("openui-renderer").closest("[data-slot='openui-block']")).toBeTruthy();
    });

    it("wraps content in OpenUI ThemeProvider using the html .dark class by default", () => {
        document.documentElement.classList.add("dark");
        render(<OpenUIBlock source="Card() {}" />);
        expect(screen.getByTestId("openui-theme-provider")).toHaveAttribute("data-mode", "dark");
        document.documentElement.classList.remove("dark");
    });

    it("honors an explicit mode override", () => {
        document.documentElement.classList.add("dark");
        render(<OpenUIBlock source="Card() {}" mode="light" />);
        expect(screen.getByTestId("openui-theme-provider")).toHaveAttribute("data-mode", "light");
        document.documentElement.classList.remove("dark");
    });
});
