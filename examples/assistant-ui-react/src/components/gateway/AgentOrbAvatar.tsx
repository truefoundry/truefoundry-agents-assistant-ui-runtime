import { cn } from "@/lib/utils";

const ORB_GRADIENTS = [
    "from-[#1194ea] to-[#0dd3c3]",
    "from-[#34f6d7] to-[#5d9bf7]",
    "from-[#fed51f] to-[#fd6734]",
] as const;

const ORB_SIZE_CLASS = {
    sm: "size-5 rounded-[10px] text-[12px]",
    lg: "size-12 rounded-full text-2xl",
} as const;

export function AgentOrbAvatar({
    label,
    index = 0,
    size = "sm",
    className,
}: {
    label: string;
    index?: number;
    size?: keyof typeof ORB_SIZE_CLASS;
    className?: string;
}) {
    const letter = label.trim().charAt(0).toUpperCase() || "?";
    const gradient = ORB_GRADIENTS[index % ORB_GRADIENTS.length];

    return (
        <span
            className={cn(
                "flex shrink-0 items-center justify-center bg-gradient-to-r font-medium text-white",
                ORB_SIZE_CLASS[size],
                gradient,
                className,
            )}
            aria-hidden
        >
            {letter}
        </span>
    );
}
