import type { RemoteThreadMetadata } from "@assistant-ui/core";

import type { Session } from "./server/types.js";

/** Map a Session DTO onto RemoteThreadMetadata, including display agentName in custom. */
export function sessionToThreadMetadata(
    session: Session,
    title: string | undefined,
): RemoteThreadMetadata {
    return {
        status: "regular",
        remoteId: session.id,
        title,
        lastMessageAt: new Date(session.updatedAt),
        ...(session.agentName != null ? { custom: { agentName: session.agentName } } : {}),
    };
}
