import { cn } from "./lib/cn.js";

export type WelcomeScreenProps = {
    heading?: string;
    className?: string;
};

export function WelcomeScreen({ heading = "How can I help you today?", className }: WelcomeScreenProps) {
    return (
        <div className={cn("aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center", className)}>
            <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-semibold duration-200">
                {heading}
            </h1>
        </div>
    );
}

declare module "../theme/SlotsProvider.js" {
    interface AtomSlots {
        WelcomeScreen: typeof WelcomeScreen;
    }
}
