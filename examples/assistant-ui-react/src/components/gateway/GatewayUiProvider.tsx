"use client";

import type { ReactNode } from "react";
import { SlotsProvider } from "@truefoundry/agent-ui-sdk";

import { GatewayWelcomeScreen } from "@/components/gateway/GatewayWelcomeScreen";
import {
    GatewayThreadComposerAreaShell,
    GatewayThreadRootShell,
    GatewayThreadViewportShell,
} from "@/components/gateway/GatewayThreadShell";

const gatewaySlotOverrides = {
    WelcomeScreen: GatewayWelcomeScreen,
    ThreadRootShell: GatewayThreadRootShell,
    ThreadViewportShell: GatewayThreadViewportShell,
    ThreadComposerAreaShell: GatewayThreadComposerAreaShell,
};

export function GatewayUiProvider({ children }: { children: ReactNode }) {
    return <SlotsProvider overrides={gatewaySlotOverrides}>{children}</SlotsProvider>;
}
