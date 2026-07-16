"use client";

import type { ThreadHistoryAdapter } from "@assistant-ui/core";
import { RuntimeAdapterProvider } from "@assistant-ui/core/react";
import { useMemo, useRef, type ComponentType, type PropsWithChildren } from "react";

import {
    TrueFoundryHistoryControllerContext,
    type TrueFoundryHistoryController,
} from "./truefoundryHistoryController.js";

export function createTrueFoundryThreadHistoryProvider(): ComponentType<PropsWithChildren> {
    return function TrueFoundryThreadHistoryProvider({ children }: PropsWithChildren) {
        const controllerRef = useRef<TrueFoundryHistoryController | null>(null);

        const history = useMemo<ThreadHistoryAdapter>(
            () => ({
                async load() {
                    const controller = controllerRef.current;
                    if (controller == null) {
                        return { messages: [] };
                    }
                    return controller.getHistoryRepository();
                },
                async append() {
                    // TrueFoundry persists turns server-side via the gateway.
                },
            }),
            [],
        );

        const contextValue = useMemo(() => ({ controllerRef }), []);

        return (
            <TrueFoundryHistoryControllerContext.Provider value={contextValue}>
                <RuntimeAdapterProvider adapters={{ history }}>{children}</RuntimeAdapterProvider>
            </TrueFoundryHistoryControllerContext.Provider>
        );
    };
}
