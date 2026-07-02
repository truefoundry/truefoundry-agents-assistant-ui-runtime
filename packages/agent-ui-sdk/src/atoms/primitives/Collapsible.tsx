import type { ComponentProps } from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

export type CollapsibleProps = ComponentProps<typeof CollapsiblePrimitive.Root>;

export function Collapsible(props: CollapsibleProps) {
    return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

export type CollapsibleTriggerProps = ComponentProps<
    typeof CollapsiblePrimitive.CollapsibleTrigger
>;

export function CollapsibleTrigger(props: CollapsibleTriggerProps) {
    return <CollapsiblePrimitive.CollapsibleTrigger data-slot="collapsible-trigger" {...props} />;
}

export type CollapsibleContentProps = ComponentProps<
    typeof CollapsiblePrimitive.CollapsibleContent
>;

export function CollapsibleContent(props: CollapsibleContentProps) {
    return <CollapsiblePrimitive.CollapsibleContent data-slot="collapsible-content" {...props} />;
}

declare module "../../theme/SlotsProvider.js" {
    interface AtomSlots {
        Collapsible: typeof Collapsible;
        CollapsibleTrigger: typeof CollapsibleTrigger;
        CollapsibleContent: typeof CollapsibleContent;
    }
}
