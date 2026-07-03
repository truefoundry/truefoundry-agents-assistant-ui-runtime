import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { TrueFoundryAgentRuntimeProvider } from "@/app/TrueFoundryAgentRuntimeProvider";
import { ErrorToasterProvider, TooltipProvider } from "@truefoundry/agent-ui-sdk";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { GatewayCredentialsProvider } from "@/lib/chat/gatewayCredentials";
import { AgentModeProvider } from "@/lib/draft/agentMode";
import { ThemeProvider, themeInitScript } from "@/lib/theme";

import "./globals.css";
import "@truefoundry/agent-ui-sdk/openui.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "TrueFoundry Agent Chat",
    description: "TrueFoundry agent chat powered by truefoundry-agents-assistant-ui-runtime",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
            suppressHydrationWarning
        >
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body
                className="flex h-dvh flex-col overflow-hidden"
                suppressHydrationWarning
            >
                <ThemeProvider>
                    <AuthProvider>
                        <GatewayCredentialsProvider>
                            <ErrorToasterProvider>
                                <AgentModeProvider>
                                    <TrueFoundryAgentRuntimeProvider>
                                        <TooltipProvider>{children}</TooltipProvider>
                                    </TrueFoundryAgentRuntimeProvider>
                                </AgentModeProvider>
                            </ErrorToasterProvider>
                        </GatewayCredentialsProvider>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
