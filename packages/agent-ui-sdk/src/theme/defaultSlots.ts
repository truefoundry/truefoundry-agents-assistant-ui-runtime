import { Avatar, AvatarFallback, AvatarImage } from "../atoms/primitives/Avatar.js";
import { Button } from "../atoms/primitives/Button.js";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "../atoms/primitives/Collapsible.js";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
} from "../atoms/primitives/Dialog.js";
import { IconButton } from "../atoms/primitives/IconButton.js";
import { Skeleton } from "../atoms/primitives/Skeleton.js";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../atoms/primitives/Tooltip.js";
import { BranchIndicator } from "../atoms/BranchIndicator.js";
import { CodeBlockHeader } from "../atoms/CodeBlockHeader.js";
import { Markdown } from "../atoms/Markdown.js";
import { OpenUIBlock } from "../atoms/OpenUIBlock.js";
import { MessageActionBar } from "../atoms/MessageActionBar.js";
import { UserMessageActionBar } from "../atoms/UserMessageActionBar.js";
import { MessageBubble } from "../atoms/MessageBubble.js";
import { MessageErrorBanner } from "../atoms/MessageErrorBanner.js";
import { MessageIndicator } from "../atoms/MessageIndicator.js";
import { ScrollToBottomButton } from "../atoms/ScrollToBottomButton.js";
import { MessageListSkeleton } from "../atoms/Skeletons.js";
import {
    MessageGroup,
    ThreadComposerAreaShell,
    ThreadRootShell,
    ThreadViewportShell,
} from "../atoms/ThreadShell.js";
import { AskUserPrompt } from "../atoms/AskUserPrompt.js";
import { AttachmentCard } from "../atoms/AttachmentCard.js";
import { AttachmentPickerButton } from "../atoms/AttachmentPickerButton.js";
import { AttachmentPreviewDialog } from "../atoms/AttachmentPreviewDialog.js";
import { ComposerShell } from "../atoms/ComposerShell.js";
import { McpAuthPrompt } from "../atoms/McpAuthPrompt.js";
import { ReasoningCard } from "../atoms/ReasoningCard.js";
import { ToolApprovalBar } from "../atoms/ToolApprovalBar.js";
import { ThreadListRow } from "../atoms/ThreadListRow.js";
import {
    ThreadListEmptyState,
    ThreadListNewButton,
    ThreadListRowSkeleton,
    ThreadListShell,
} from "../atoms/ThreadListMisc.js";
import { Toast, ToastStack } from "../atoms/Toast.js";
import { ToolCallCard } from "../atoms/ToolCallCard.js";
import { ToolGroupCard } from "../atoms/ToolGroupCard.js";
import { WelcomeScreen } from "../atoms/WelcomeScreen.js";
import type { AtomSlots } from "./SlotsProvider.js";

/**
 * This SDK's default atom implementations, keyed by slot name. Populated
 * incrementally as atoms are added under `src/atoms/**`; each atom module
 * augments `AtomSlots` and this object gains the matching entry in the same
 * milestone.
 */
export const defaultSlots: AtomSlots = {
    Button,
    IconButton,
    Avatar,
    AvatarImage,
    AvatarFallback,
    Tooltip,
    TooltipProvider,
    TooltipTrigger,
    TooltipContent,
    Dialog,
    DialogTrigger,
    DialogPortal,
    DialogClose,
    DialogOverlay,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
    Skeleton,
    Markdown,
    OpenUIBlock,
    CodeBlockHeader,
    MessageBubble,
    MessageErrorBanner,
    MessageActionBar,
    UserMessageActionBar,
    BranchIndicator,
    MessageIndicator,
    WelcomeScreen,
    MessageListSkeleton,
    ScrollToBottomButton,
    ThreadRootShell,
    ThreadViewportShell,
    ThreadComposerAreaShell,
    MessageGroup,
    ToolCallCard,
    ToolApprovalBar,
    ToolGroupCard,
    ReasoningCard,
    ComposerShell,
    AskUserPrompt,
    McpAuthPrompt,
    AttachmentCard,
    AttachmentPreviewDialog,
    AttachmentPickerButton,
    ThreadListRow,
    ThreadListNewButton,
    ThreadListRowSkeleton,
    ThreadListEmptyState,
    ThreadListShell,
    Toast,
    ToastStack,
};
