/**
 * Stable discriminant for hosts that cannot import the class (older runtime
 * versions still report plain errors, so matching on `name` degrades safely).
 */
export const TURN_RESUME_UNSUPPORTED_ERROR_NAME = "TurnResumeUnsupportedError";

/**
 * Reported when a session loads while a turn is still running but the server
 * omits the optional `subscribeToTurn`, so the in-flight response cannot be
 * followed. The turn keeps running on the backend; only the live view is lost.
 */
export class TurnResumeUnsupportedError extends Error {
    constructor() {
        super(
            "This response is still being generated, but it cannot be streamed here. Reload the conversation to see the result.",
        );
        this.name = TURN_RESUME_UNSUPPORTED_ERROR_NAME;
    }
}
