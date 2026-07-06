import { describe, expect, it, vi } from "vitest";
import type {
    AgentSession,
    Turn,
    TurnStreamData,
} from "truefoundry-gateway-sdk/agents";

import { ROOT_THREAD_ID } from "./constants.js";
import { PeerThreadFoldState } from "./foldPeerThreads.js";
import { resumeTurnStream, streamTurnContent } from "./streamTurn.js";

const createdAt = new Date().toISOString();

function streamData(
    sequenceNumber: number,
    event: TurnStreamData["event"],
): TurnStreamData {
    return { sequenceNumber, event };
}

async function collectUpdates(
    generator: AsyncGenerator<{ content: unknown[] }>,
): Promise<{ content: unknown[] }[]> {
    const updates: { content: unknown[] }[] = [];
    for await (const update of generator) {
        updates.push(update);
    }
    return updates;
}

describe("streamTurn", () => {
    describe("streamTurnContent", () => {
        it("prepares a user turn and yields folded stream updates", async () => {
            const foldState = new PeerThreadFoldState();
            const execute = vi.fn(() =>
                (async function* () {
                    yield streamData(1, {
                        type: "model.message",
                        createdAt,
                        id: "m1",
                        threadId: ROOT_THREAD_ID,
                        content: "hello from stream",
                    });
                })(),
            );
            const prepareTurn = vi.fn(() => ({ execute }));
            const session = {
                prepareTurn,
                cancel: vi.fn().mockResolvedValue(undefined),
            } as unknown as AgentSession;

            const updates = await collectUpdates(
                streamTurnContent(
                    session,
                    foldState,
                    { userMessage: "hello" },
                    new AbortController().signal,
                ),
            );

            expect(prepareTurn).toHaveBeenCalledWith({
                input: [{ type: "user.message", content: "hello" }],
                previousTurnId: "auto",
            });
            expect(updates).toEqual([
                { content: [{ type: "text", text: "hello from stream" }] },
            ]);
        });

        it("passes required-action inputs through prepareTurn", async () => {
            const inputs = [
                {
                    type: "user.tool_approval" as const,
                    threadId: ROOT_THREAD_ID,
                    toolCallId: "approval-1",
                    approval: { status: "allow" as const },
                },
                {
                    type: "user.tool_response" as const,
                    threadId: ROOT_THREAD_ID,
                    toolCallId: "question-1",
                    content: "A",
                },
            ];
            const execute = vi.fn(() => (async function* () {})());
            const prepareTurn = vi.fn(() => ({ execute }));
            const session = {
                prepareTurn,
                cancel: vi.fn().mockResolvedValue(undefined),
            } as unknown as AgentSession;

            await collectUpdates(
                streamTurnContent(
                    session,
                    new PeerThreadFoldState(),
                    { inputs },
                    new AbortController().signal,
                ),
            );

            expect(prepareTurn).toHaveBeenCalledWith({
                input: inputs,
                previousTurnId: "auto",
            });
        });

        it("uses empty input when resuming after MCP auth", async () => {
            const execute = vi.fn(() => (async function* () {})());
            const prepareTurn = vi.fn(() => ({ execute }));
            const session = {
                prepareTurn,
                cancel: vi.fn().mockResolvedValue(undefined),
            } as unknown as AgentSession;

            await collectUpdates(
                streamTurnContent(
                    session,
                    new PeerThreadFoldState(),
                    { resumeMcpAuth: true },
                    new AbortController().signal,
                ),
            );

            expect(prepareTurn).toHaveBeenCalledWith({
                input: [],
                previousTurnId: "auto",
            });
        });

        it("forwards an explicit previousTurnId when branching", async () => {
            const execute = vi.fn(() => (async function* () {})());
            const prepareTurn = vi.fn(() => ({ execute }));
            const session = {
                prepareTurn,
                cancel: vi.fn().mockResolvedValue(undefined),
            } as unknown as AgentSession;

            await collectUpdates(
                streamTurnContent(
                    session,
                    new PeerThreadFoldState(),
                    { userMessage: "edited", previousTurnId: "turn-a" },
                    new AbortController().signal,
                ),
            );

            expect(prepareTurn).toHaveBeenCalledWith({
                input: [{ type: "user.message", content: "edited" }],
                previousTurnId: "turn-a",
            });
        });

        it("omits previousTurnId when branching from root", async () => {
            const execute = vi.fn(() => (async function* () {})());
            const prepareTurn = vi.fn(() => ({ execute }));
            const session = {
                prepareTurn,
                cancel: vi.fn().mockResolvedValue(undefined),
            } as unknown as AgentSession;

            await collectUpdates(
                streamTurnContent(
                    session,
                    new PeerThreadFoldState(),
                    { userMessage: "first", previousTurnId: null },
                    new AbortController().signal,
                ),
            );

            expect(prepareTurn).toHaveBeenCalledWith({
                input: [{ type: "user.message", content: "first" }],
            });
        });

        it("returns early and cancels the session when already aborted", async () => {
            const execute = vi.fn(() => (async function* () {})());
            const prepareTurn = vi.fn(() => ({ execute }));
            const cancel = vi.fn().mockResolvedValue(undefined);
            const session = { prepareTurn, cancel } as unknown as AgentSession;
            const abortController = new AbortController();
            abortController.abort();

            const updates = await collectUpdates(
                streamTurnContent(
                    session,
                    new PeerThreadFoldState(),
                    { userMessage: "hello" },
                    abortController.signal,
                ),
            );

            expect(cancel).toHaveBeenCalled();
            expect(execute).not.toHaveBeenCalled();
            expect(updates).toEqual([]);
        });
    });

    describe("resumeTurnStream", () => {
        it("reconnects with afterSequenceNumber and yields updates", async () => {
            const foldState = new PeerThreadFoldState();
            const stream = vi.fn(() =>
                (async function* () {
                    yield streamData(2, {
                        type: "model.message",
                        createdAt,
                        id: "m2",
                        threadId: ROOT_THREAD_ID,
                        content: "resumed",
                    });
                })(),
            );
            const turn = {
                stream,
                session: { cancel: vi.fn().mockResolvedValue(undefined) },
            } as unknown as Turn;

            const updates = await collectUpdates(
                resumeTurnStream(turn, foldState, new AbortController().signal, 1),
            );
            expect(stream).toHaveBeenCalledWith({ afterSequenceNumber: 1 }, expect.any(Object));
            expect(updates).toEqual([{ content: [{ type: "text", text: "resumed" }] }]);
        });

        it("returns early when aborted before streaming starts", async () => {
            const stream = vi.fn(() => (async function* () {})());
            const cancel = vi.fn().mockResolvedValue(undefined);
            const turn = {
                stream,
                session: { cancel },
            } as unknown as Turn;
            const abortController = new AbortController();
            abortController.abort();

            const updates = await collectUpdates(
                resumeTurnStream(turn, new PeerThreadFoldState(), abortController.signal),
            );

            expect(cancel).toHaveBeenCalled();
            expect(stream).not.toHaveBeenCalled();
            expect(updates).toEqual([]);
        });
    });
});
