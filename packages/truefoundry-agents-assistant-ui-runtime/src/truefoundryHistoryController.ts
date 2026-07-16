"use client";

import type { ExportedMessageRepository } from "@assistant-ui/core";
import { createContext, useContext, type MutableRefObject } from "react";

export type TrueFoundryHistoryPaginationState = {
    hasMore: boolean;
    isLoadingMore: boolean;
    nextPageToken: string | undefined;
};

export type TrueFoundryHistoryController = {
    getHistoryRepository: () => ExportedMessageRepository & {
        state?: { nextPageToken?: string | undefined };
    };
    getPaginationState: () => TrueFoundryHistoryPaginationState;
    loadOlder: () => Promise<void>;
};

export type TrueFoundryHistoryControllerContextValue = {
    controllerRef: MutableRefObject<TrueFoundryHistoryController | null>;
};

const TrueFoundryHistoryControllerContext =
    createContext<TrueFoundryHistoryControllerContextValue | null>(null);

export function useTrueFoundryHistoryControllerContext():
    | TrueFoundryHistoryControllerContextValue
    | null {
    return useContext(TrueFoundryHistoryControllerContext);
}

export { TrueFoundryHistoryControllerContext };
