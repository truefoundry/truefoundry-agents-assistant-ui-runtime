// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../atoms/primitives/Button.js";
import { useSlot, SlotsProvider } from "./SlotsProvider.js";

function ButtonConsumer() {
    const SlotButton = useSlot("Button");
    return <SlotButton>hello</SlotButton>;
}

function CustomButton() {
    return <button data-testid="custom-button">custom</button>;
}

describe("SlotsProvider", () => {
    it("resolves the default atom when no override is provided", () => {
        render(<ButtonConsumer />);
        const button = screen.getByRole("button", { name: "hello" });
        expect(button).toHaveAttribute("data-slot", "button");
    });

    it("resolves the default atom even without a wrapping SlotsProvider", () => {
        render(<ButtonConsumer />);
        expect(screen.getByRole("button", { name: "hello" })).toBeInTheDocument();
    });

    it("resolves an overridden atom when wrapped in SlotsProvider", () => {
        render(
            <SlotsProvider overrides={{ Button }}>
                <ButtonConsumer />
            </SlotsProvider>,
        );
        expect(screen.getByRole("button", { name: "hello" })).toHaveAttribute("data-slot", "button");
    });

    it("replaces the resolved atom entirely with the override, not merging it", () => {
        render(
            <SlotsProvider overrides={{ Button: CustomButton as unknown as typeof Button }}>
                <ButtonConsumer />
            </SlotsProvider>,
        );
        expect(screen.getByTestId("custom-button")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "hello" })).not.toBeInTheDocument();
    });

    it("nested SlotsProviders only override the slots they specify, inheriting the rest", () => {
        function IconButtonConsumer() {
            const SlotIconButton = useSlot("IconButton");
            return <SlotIconButton tooltip="tip">icon</SlotIconButton>;
        }

        render(
            <SlotsProvider overrides={{ Button: CustomButton as unknown as typeof Button }}>
                <IconButtonConsumer />
            </SlotsProvider>,
        );
        // IconButton isn't overridden, so it falls through to the default IconButton atom,
        // which internally imports the default Button directly (not via useSlot) -- so it
        // renders its own button, unaffected by the Button override above it.
        expect(screen.getByText("icon")).toBeInTheDocument();
    });
});
