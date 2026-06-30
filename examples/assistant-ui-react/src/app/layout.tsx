import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { TrueFoundryAgentRuntimeProvider } from "@/app/TrueFoundryAgentRuntimeProvider";
import { ErrorToasterProvider } from "@/components/assistant-ui/error-toaster";
import { GatewayCredentialsProvider } from "@/lib/chat/gatewayCredentials";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

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
            <body
                className="flex h-dvh flex-col overflow-hidden"
                suppressHydrationWarning
            >
                <GatewayCredentialsProvider>
                    <ErrorToasterProvider>
                        <TrueFoundryAgentRuntimeProvider>
                            <TooltipProvider>{children}</TooltipProvider>
                        </TrueFoundryAgentRuntimeProvider>
                    </ErrorToasterProvider>
                </GatewayCredentialsProvider>
            </body>
        </html>
    );
}
