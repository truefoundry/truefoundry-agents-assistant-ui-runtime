// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Markdown } from "./Markdown.js";

describe("Markdown sandbox_artifact rendering", () => {
    it("calls onDownloadArtifact with the link's exact path when clicked", () => {
        const onDownloadArtifact = vi.fn();
        render(
            <Markdown
                content="sandbox_artifact [Download the pink dog SVG](/tmp/pink_dog.svg)"
                onDownloadArtifact={onDownloadArtifact}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /Download the pink dog SVG/ }));

        expect(onDownloadArtifact).toHaveBeenCalledExactlyOnceWith("/tmp/pink_dog.svg");
    });

    it("does not throw when no onDownloadArtifact handler is provided", () => {
        render(<Markdown content="sandbox_artifact [Download](/tmp/a.svg)" />);
        expect(() =>
            fireEvent.click(screen.getByRole("button", { name: /Download/ })),
        ).not.toThrow();
    });
});
