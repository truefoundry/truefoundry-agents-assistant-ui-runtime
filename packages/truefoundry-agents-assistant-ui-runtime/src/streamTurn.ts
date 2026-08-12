import type {
    AgentChatServer,
    PreviousTurnIdInput,
    TurnInputItem,
} from "./server/types.js";
import type { TurnStreamData } from "./server/events.js";

import {
    streamTurnEvents,
    type UserMessageContent,
} from "./convertTurnMessages.js";
import { PeerThreadFoldState } from "./foldPeerThreads.js";
import type { RequiredActionInput } from "./requiredActionInputs.js";
import type { TurnStreamUpdate } from "./turnStreamUpdate.js";

export type StreamTurnOptions = {
    userMessage?: UserMessageContent;
    resumeMcpAuth?: boolean;
    inputs?: RequiredActionInput[];
    /**
     * Branch anchor for createTurn. Omit for `"auto"`. Pass `"none"` for a fresh
     * root turn.
     */
    previousTurnId?: PreviousTurnIdInput;
    /** Extra headers for the turn request. */
    headers?: Record<string, string>;
};

function buildTurnInput(options: StreamTurnOptions): TurnInputItem[] {
    if (options.inputs != null) {
        return options.inputs;
    }
    if (options.resumeMcpAuth === true) {
        return [];
    }
    return [{ type: "user.message", content: options.userMessage ?? "" }];
}

function bindAbort(
    server: AgentChatServer,
    sessionId: string,
    abortSignal: AbortSignal,
): () => void {
    const onAbort = () => {
        void server.cancelSession({ sessionId }).catch(() => undefined);
    };
    if (abortSignal.aborted) {
        onAbort();
        return onAbort;
    }
    abortSignal.addEventListener("abort", onAbort, { once: true });
    return onAbort;
}

export async function* streamTurnContent(
    server: AgentChatServer,
    sessionId: string,
    foldState: PeerThreadFoldState,
    options: StreamTurnOptions,
    abortSignal: AbortSignal,
    groupRootBaseline?: readonly string[],
    /**
     * Called once with the turn ID as soon as it becomes available (first
     * `turn.created` SSE event). Use this to reconcile the locally-generated
     * optimistic ID with the real turn ID.
     */
    onTurnIdAvailable?: (turnId: string) => void,
): AsyncGenerator<TurnStreamUpdate> {
    const onAbort = bindAbort(server, sessionId, abortSignal);
    if (abortSignal.aborted) {
        return;
    }

    let turnIdNotified = false;
    const notifyTurnId = (turnId: string) => {
        if (!turnIdNotified) {
            onTurnIdAvailable?.(turnId);
            turnIdNotified = true;
        }
    };

    const stream: AsyncIterable<TurnStreamData> = server.createTurn({
        sessionId,
        input: buildTurnInput(options),
        previousTurnId: options.previousTurnId ?? "auto",
        abortSignal,
        ...(options.headers != null ? { headers: options.headers } : {}),
    });

    try {
        for await (const update of streamTurnEvents(
            stream,
            foldState,
            groupRootBaseline,
            notifyTurnId,
        )) {
            yield update;
        }
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return;
        }
        throw error;
    } finally {
        abortSignal.removeEventListener("abort", onAbort);
    }
}

/** TODO: wire `afterSequenceNumber` from the last ingested stream event to skip replay on reconnect. */
export async function* resumeTurnStream(
    server: AgentChatServer,
    sessionId: string,
    turnId: string,
    foldState: PeerThreadFoldState,
    abortSignal: AbortSignal,
    afterSequenceNumber?: number,
    groupRootBaseline?: readonly string[],
): AsyncGenerator<TurnStreamUpdate> {
    // Optional on custom backends. Callers detect the gap and report it, so an
    // empty stream here is safer than throwing mid-render.
    if (server.subscribeToTurn == null) {
        return;
    }

    const onAbort = () => {
        void server.cancelSession({ sessionId }).catch(() => undefined);
    };
    if (abortSignal.aborted) {
        onAbort();
        return;
    }
    abortSignal.addEventListener("abort", onAbort, { once: true });

    try {
        yield* streamTurnEvents(
            server.subscribeToTurn({
                sessionId,
                turnId,
                ...(afterSequenceNumber != null
                    ? { afterSequenceNumber }
                    : {}),
                abortSignal,
            }),
            foldState,
            groupRootBaseline,
        );
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return;
        }
        throw error;
    } finally {
        abortSignal.removeEventListener("abort", onAbort);
    }
}
