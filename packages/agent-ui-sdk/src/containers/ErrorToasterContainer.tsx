"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TrueFoundryGatewayError } from "truefoundry-gateway-sdk";

import { useSlot } from "../theme/SlotsProvider.js";

type ErrorToastContent = { title: string; description: string };

type ErrorToasterContextValue = { showError: (error: unknown) => void };

const ErrorToasterContext = createContext<ErrorToasterContextValue | null>(null);

function formatErrorBody(body: unknown): string | undefined {
    if (body == null) return undefined;
    if (typeof body === "string") return body;
    try {
        return JSON.stringify(body, null, 2);
    } catch {
        return String(body);
    }
}

function normalizeError(error: unknown): ErrorToastContent {
    if (error instanceof TrueFoundryGatewayError) {
        const statusCode = error.statusCode;
        const title = statusCode != null ? `Request failed (${statusCode})` : "Request failed";
        const description = formatErrorBody(error.body) ?? (error.message || "The gateway returned an error.");
        return { title, description };
    }

    if (error instanceof Error) {
        return { title: "Something went wrong", description: error.message || "An unexpected error occurred." };
    }

    return { title: "Something went wrong", description: String(error) };
}

export function ErrorToasterProvider({ children }: { children: ReactNode }) {
    const ToastStack = useSlot("ToastStack");
    const Toast = useSlot("Toast");

    const [toast, setToast] = useState<ErrorToastContent | null>(null);
    const [open, setOpen] = useState(false);

    const showError = useCallback((error: unknown) => {
        setToast(normalizeError(error));
        setOpen(true);
    }, []);

    const value = useMemo(() => ({ showError }), [showError]);

    return (
        <ErrorToasterContext.Provider value={value}>
            <ToastStack>
                {children}
                {toast != null && (
                    <Toast title={toast.title} description={toast.description} open={open} onOpenChange={setOpen} />
                )}
            </ToastStack>
        </ErrorToasterContext.Provider>
    );
}

export function useErrorToaster(): ErrorToasterContextValue {
    const context = useContext(ErrorToasterContext);
    if (context == null) {
        throw new Error("useErrorToaster must be used within ErrorToasterProvider");
    }
    return context;
}

/** Same as `useErrorToaster`, but returns `null` instead of throwing outside `ErrorToasterProvider`. */
export function useErrorToasterOptional(): ErrorToasterContextValue | null {
    return useContext(ErrorToasterContext);
}
