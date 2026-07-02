"use client";

import { ThreadContainer } from "./ThreadContainer.js";
import { ComposerContainer } from "./ComposerContainer.js";

/** The full assembled thread view: message list + composer. */
export function Thread() {
    return <ThreadContainer composer={<ComposerContainer />} />;
}
