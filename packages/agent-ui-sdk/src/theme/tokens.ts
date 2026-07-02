import { createContext, createElement, useContext, type ReactNode } from "react";

/**
 * Semantic color roles. Atoms reference these instead of raw hex/HSL values so a
 * future design-system swap only has to repoint the token values, not the atoms.
 */
export type ColorToken =
    | "background"
    | "foreground"
    | "muted"
    | "mutedForeground"
    | "border"
    | "primary"
    | "primaryForeground"
    | "destructive"
    | "destructiveForeground"
    | "accent"
    | "accentForeground";

export type RadiusToken = "none" | "sm" | "md" | "lg" | "full";

export type SpacingToken = "none" | "xs" | "sm" | "md" | "lg" | "xl";

export type TypeRoleToken = "body" | "bodySmall" | "label" | "heading" | "code" | "caption";

export interface TypeRoleValue {
    fontSize: string;
    lineHeight: string;
    fontWeight: string | number;
}

export interface DesignTokens {
    colors: Record<ColorToken, string>;
    radii: Record<RadiusToken, string>;
    spacing: Record<SpacingToken, string>;
    typography: Record<TypeRoleToken, TypeRoleValue>;
}

/**
 * Values reference the CSS custom properties already emitted by the shadcn/Tailwind
 * theme in the ported reference app, so default atoms render identically to today
 * without requiring every atom to be rewritten to consume tokens in this pass.
 */
export const defaultTokens: DesignTokens = {
    colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        mutedForeground: "var(--muted-foreground)",
        border: "var(--border)",
        primary: "var(--primary)",
        primaryForeground: "var(--primary-foreground)",
        destructive: "var(--destructive)",
        destructiveForeground: "var(--destructive-foreground)",
        accent: "var(--accent)",
        accentForeground: "var(--accent-foreground)",
    },
    radii: {
        none: "0px",
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        full: "9999px",
    },
    spacing: {
        none: "0px",
        xs: "0.25rem",
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
    },
    typography: {
        body: { fontSize: "0.875rem", lineHeight: "1.5rem", fontWeight: 400 },
        bodySmall: { fontSize: "0.75rem", lineHeight: "1.25rem", fontWeight: 400 },
        label: { fontSize: "0.75rem", lineHeight: "1rem", fontWeight: 500 },
        heading: { fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: 600 },
        code: { fontSize: "0.8125rem", lineHeight: "1.25rem", fontWeight: 400 },
        caption: { fontSize: "0.6875rem", lineHeight: "1rem", fontWeight: 400 },
    },
};

const TokensContext = createContext<DesignTokens>(defaultTokens);

export function TokensProvider({
    tokens,
    children,
}: {
    tokens: DesignTokens;
    children: ReactNode;
}) {
    return createElement(TokensContext.Provider, { value: tokens }, children);
}

/** Atoms may call this for theme-driven values; it is not an assistant-ui/runtime hook. */
export function useTokens(): DesignTokens {
    return useContext(TokensContext);
}
