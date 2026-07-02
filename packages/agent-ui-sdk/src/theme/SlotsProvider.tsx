import { createContext, useContext, useMemo, type ReactNode } from "react";

import { defaultSlots } from "./defaultSlots.js";

/**
 * Registry of atom-name -> atom-implementation. Empty by default; each atom module
 * augments this interface via `declare module "../theme/SlotsProvider"` when it is
 * introduced, so adding an atom never requires editing this file or any container.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AtomSlots {}

export type SlotOverrides = Partial<AtomSlots>;

const SlotsContext = createContext<AtomSlots>(defaultSlots);

/**
 * Wrap a subtree to override one or more atoms with a different design system.
 * Containers never reference concrete atoms directly -- they resolve everything
 * through `useSlot`, so this is the only thing a design-system swap has to touch.
 */
export function SlotsProvider({
    overrides,
    children,
}: {
    overrides?: SlotOverrides;
    children: ReactNode;
}) {
    const parentSlots = useContext(SlotsContext);
    const resolved = useMemo(
        () => ({ ...parentSlots, ...overrides }),
        [parentSlots, overrides],
    );
    return <SlotsContext.Provider value={resolved}>{children}</SlotsContext.Provider>;
}

/** Resolves the atom implementation registered for `name` -- default unless overridden. */
export function useSlot<K extends keyof AtomSlots>(name: K): AtomSlots[K] {
    const slots = useContext(SlotsContext);
    return slots[name];
}
