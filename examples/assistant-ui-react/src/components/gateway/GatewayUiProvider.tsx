"use client";

import { SlotsProvider } from "@truefoundry/agent-ui-sdk";
import type { ReactNode } from "react";

import {
    GatewayThreadComposerAreaShell,
    GatewayThreadRootShell,
    GatewayThreadViewportShell,
} from "@/components/gateway/GatewayThreadShell";
import { GatewayWelcomeScreen } from "@/components/gateway/GatewayWelcomeScreen";

const gatewaySlotOverrides = {
    WelcomeScreen: GatewayWelcomeScreen,
    ThreadRootShell: GatewayThreadRootShell,
    ThreadViewportShell: GatewayThreadViewportShell,
    ThreadComposerAreaShell: GatewayThreadComposerAreaShell,
};

export function GatewayUiProvider({ children }: { children: ReactNode }) {
    return <SlotsProvider overrides={gatewaySlotOverrides}>{children}</SlotsProvider>;
}
