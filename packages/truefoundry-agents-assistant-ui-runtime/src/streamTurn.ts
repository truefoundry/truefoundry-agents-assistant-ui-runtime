import {
    type AgentSession,
    type Turn,
    type TurnInputItem,
} from "truefoundry-gateway-sdk/agents";

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
     * Branch anchor for `prepareTurn`. Omit for `"auto"`. Pass `null` for a fresh
     * root turn (no `previousTurnId` field).
     */
    previousTurnId?: string | null;
    /** Extra headers for the createTurn request (`execute` request options). */
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

function bindAbort(session: AgentSession, abortSignal: AbortSignal): () => void {
    const onAbort = () => {
        void session.cancel().catch(() => undefined);
    };
    if (abortSignal.aborted) {
        onAbort();
        return onAbort;
    }
    abortSignal.addEventListener("abort", onAbort, { once: true });
    return onAbort;
}

export async function* streamTurnContent(
    session: AgentSession,
    foldState: PeerThreadFoldState,
    options: StreamTurnOptions,
    abortSignal: AbortSignal,
    groupRootBaseline?: readonly string[],
): AsyncGenerator<TurnStreamUpdate> {
    const previousTurnId =
        options.previousTurnId === null
            ? undefined
            : (options.previousTurnId ?? "auto");
    const turn = session.prepareTurn({
        input: buildTurnInput(options),
        ...(previousTurnId != null ? { previousTurnId } : {}),
    });

    const onAbort = bindAbort(session, abortSignal);
    if (abortSignal.aborted) {
        return;
    }

    try {
        yield* streamTurnEvents(
            turn.execute(
                { stream: true },
                {
                    abortSignal,
                    ...(options.headers != null ? { headers: options.headers } : {}),
                },
            ),
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

/** TODO: wire `afterSequenceNumber` from the last ingested stream event to skip replay on reconnect. */
export async function* resumeTurnStream(
    turn: Turn,
    foldState: PeerThreadFoldState,
    abortSignal: AbortSignal,
    afterSequenceNumber?: number,
    groupRootBaseline?: readonly string[],
): AsyncGenerator<TurnStreamUpdate> {
    const onAbort = () => {
        void turn.session.cancel().catch(() => undefined);
    };
    if (abortSignal.aborted) {
        onAbort();
        return;
    }
    abortSignal.addEventListener("abort", onAbort, { once: true });

    try {
        yield* streamTurnEvents(
            turn.stream(
                afterSequenceNumber != null ? { afterSequenceNumber } : {},
                { abortSignal },
            ),
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
