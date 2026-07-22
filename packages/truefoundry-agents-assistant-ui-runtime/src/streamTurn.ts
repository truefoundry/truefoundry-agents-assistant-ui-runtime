import {
    type AgentSession,
    type Turn,
    type TurnInputItem,
    TrueFoundryGatewayApi,
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
     * root turn — sent as `previous_turn_id: null` on the wire.
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
    /**
     * Called once with the gateway-assigned turn ID as soon as it becomes
     * available (after the first `turn.created` SSE event). Use this to
     * reconcile the locally-generated optimistic ID with the real gateway ID
     * so that edit/retry can find the turn in `buildSnapshotBeforeTurn`.
     */
    onTurnIdAvailable?: (turnId: string) => void,
): AsyncGenerator<TurnStreamUpdate> {
    // When previousTurnId is explicitly null, pass it through to prepareTurn so the
    // SDK serializer emits `previous_turn_id: null` on the wire (first turn in session).
    // The SDK type doesn't admit null, but the Fern serializer handles it correctly.
    const previousTurnId: TrueFoundryGatewayApi.PreviousTurnIdInput | null | undefined =
        options.previousTurnId === null
            ? null
            : (options.previousTurnId ?? "auto");
    const turn = session.prepareTurn({
        input: buildTurnInput(options),
        ...(previousTurnId !== undefined
            ? { previousTurnId: previousTurnId as TrueFoundryGatewayApi.PreviousTurnIdInput }
            : {}),
    });

    const onAbort = bindAbort(session, abortSignal);
    if (abortSignal.aborted) {
        return;
    }

    try {
        let turnIdNotified = false;
        for await (const update of streamTurnEvents(
            turn.execute(
                { stream: true },
                {
                    abortSignal,
                    ...(options.headers != null ? { headers: options.headers } : {}),
                },
            ),
            foldState,
            groupRootBaseline,
        )) {
            // After the first `turn.created` event, `turn.id` is set.
            // Notify BEFORE yielding so the caller can update its tracking
            // before the snapshot is written with the stream update.
            if (!turnIdNotified && turn.id != null) {
                onTurnIdAvailable?.(turn.id);
                turnIdNotified = true;
            }
            yield update;
        }
        // Handle streams that complete without yielding any content.
        if (!turnIdNotified && turn.id != null) {
            onTurnIdAvailable?.(turn.id);
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
