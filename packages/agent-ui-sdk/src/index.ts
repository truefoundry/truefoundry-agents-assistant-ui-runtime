"use client";

export { SlotsProvider, useSlot } from "./theme/SlotsProvider.js";
export type { AtomSlots, SlotOverrides } from "./theme/SlotsProvider.js";
export { defaultSlots } from "./theme/defaultSlots.js";
export { TokensProvider, useTokens, defaultTokens } from "./theme/tokens.js";
export type {
    ColorToken,
    RadiusToken,
    SpacingToken,
    TypeRoleToken,
    TypeRoleValue,
    DesignTokens,
} from "./theme/tokens.js";

export { Button, buttonVariants } from "./atoms/primitives/Button.js";
export type { ButtonProps } from "./atoms/primitives/Button.js";
export { IconButton } from "./atoms/primitives/IconButton.js";
export type { IconButtonProps } from "./atoms/primitives/IconButton.js";
export { Avatar, AvatarImage, AvatarFallback } from "./atoms/primitives/Avatar.js";
export type {
    AvatarProps,
    AvatarImageProps,
    AvatarFallbackProps,
} from "./atoms/primitives/Avatar.js";
export {
    Tooltip,
    TooltipProvider,
    TooltipTrigger,
    TooltipContent,
} from "./atoms/primitives/Tooltip.js";
export type {
    TooltipProps,
    TooltipProviderProps,
    TooltipTriggerProps,
    TooltipContentProps,
} from "./atoms/primitives/Tooltip.js";
export {
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
} from "./atoms/primitives/Dialog.js";
export type {
    DialogProps,
    DialogTriggerProps,
    DialogPortalProps,
    DialogCloseProps,
    DialogOverlayProps,
    DialogContentProps,
    DialogHeaderProps,
    DialogFooterProps,
    DialogTitleProps,
    DialogDescriptionProps,
} from "./atoms/primitives/Dialog.js";
export {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "./atoms/primitives/Collapsible.js";
export type {
    CollapsibleProps,
    CollapsibleTriggerProps,
    CollapsibleContentProps,
} from "./atoms/primitives/Collapsible.js";
export { Skeleton } from "./atoms/primitives/Skeleton.js";
export type { SkeletonProps } from "./atoms/primitives/Skeleton.js";

export { Markdown } from "./atoms/Markdown.js";
export type { MarkdownProps } from "./atoms/Markdown.js";
export { CodeBlockHeader } from "./atoms/CodeBlockHeader.js";
export type { CodeBlockHeaderProps } from "./atoms/CodeBlockHeader.js";
export { MessageBubble } from "./atoms/MessageBubble.js";
export type {
    MessageBubbleProps,
    AssistantMessageBubbleProps,
    UserMessageBubbleProps,
} from "./atoms/MessageBubble.js";
export { MessageErrorBanner } from "./atoms/MessageErrorBanner.js";
export type { MessageErrorBannerProps } from "./atoms/MessageErrorBanner.js";
export { MessageActionBar } from "./atoms/MessageActionBar.js";
export type { MessageActionBarProps } from "./atoms/MessageActionBar.js";
export { BranchIndicator } from "./atoms/BranchIndicator.js";
export type { BranchIndicatorProps } from "./atoms/BranchIndicator.js";
export { MessageIndicator } from "./atoms/MessageIndicator.js";
export type { MessageIndicatorProps } from "./atoms/MessageIndicator.js";
export { WelcomeScreen } from "./atoms/WelcomeScreen.js";
export type { WelcomeScreenProps } from "./atoms/WelcomeScreen.js";
export { MessageListSkeleton } from "./atoms/Skeletons.js";
export type { MessageListSkeletonProps } from "./atoms/Skeletons.js";
export { ScrollToBottomButton } from "./atoms/ScrollToBottomButton.js";
export type { ScrollToBottomButtonProps } from "./atoms/ScrollToBottomButton.js";
export {
    ThreadRootShell,
    ThreadViewportShell,
    ThreadComposerAreaShell,
    MessageGroup,
} from "./atoms/ThreadShell.js";
export type {
    ThreadRootShellProps,
    ThreadViewportShellProps,
    ThreadComposerAreaShellProps,
    MessageGroupProps,
} from "./atoms/ThreadShell.js";

export { ToolCallCard } from "./atoms/ToolCallCard.js";
export type {
    ToolCallStatus,
    ToolCallCardProps,
    ToolCallCardToolProps,
    ToolCallCardSubAgentProps,
    ToolCallCardMcpProps,
} from "./atoms/ToolCallCard.js";
export { ToolApprovalBar } from "./atoms/ToolApprovalBar.js";
export type { ToolApprovalOption, ToolApprovalBarProps } from "./atoms/ToolApprovalBar.js";
export { ToolGroupCard } from "./atoms/ToolGroupCard.js";
export type { ToolGroupCardProps } from "./atoms/ToolGroupCard.js";
export { ReasoningCard } from "./atoms/ReasoningCard.js";
export type { ReasoningCardProps } from "./atoms/ReasoningCard.js";
export { ComposerShell } from "./atoms/ComposerShell.js";
export type { ComposerShellProps } from "./atoms/ComposerShell.js";
export { AskUserPrompt } from "./atoms/AskUserPrompt.js";
export type { AskUserOption, AskUserPromptProps } from "./atoms/AskUserPrompt.js";
export { McpAuthPrompt } from "./atoms/McpAuthPrompt.js";
export type { McpAuthServer, McpAuthPromptProps } from "./atoms/McpAuthPrompt.js";
export { AttachmentCard } from "./atoms/AttachmentCard.js";
export type { AttachmentCardProps } from "./atoms/AttachmentCard.js";
export { AttachmentPreviewDialog } from "./atoms/AttachmentPreviewDialog.js";
export type { AttachmentPreviewDialogProps } from "./atoms/AttachmentPreviewDialog.js";
export { AttachmentPickerButton } from "./atoms/AttachmentPickerButton.js";
export type { AttachmentPickerButtonProps } from "./atoms/AttachmentPickerButton.js";
export { ThreadListRow } from "./atoms/ThreadListRow.js";
export type { ThreadListRowProps } from "./atoms/ThreadListRow.js";
export {
    ThreadListNewButton,
    ThreadListRowSkeleton,
    ThreadListEmptyState,
    ThreadListShell,
} from "./atoms/ThreadListMisc.js";
export type {
    ThreadListNewButtonProps,
    ThreadListRowSkeletonProps,
    ThreadListEmptyStateProps,
    ThreadListShellProps,
} from "./atoms/ThreadListMisc.js";
export { Toast, ToastStack } from "./atoms/Toast.js";
export type { ToastProps, ToastStackProps } from "./atoms/Toast.js";

export { ThreadContainer } from "./containers/ThreadContainer.js";
export type { ThreadContainerProps } from "./containers/ThreadContainer.js";
export { AssistantMessageContainer } from "./containers/AssistantMessageContainer.js";
export { UserMessageContainer } from "./containers/UserMessageContainer.js";
export { AssistantTextContainer } from "./containers/AssistantTextContainer.js";
export { ToolCallContainer } from "./containers/ToolCallContainer.js";
export { ToolGroupContainer } from "./containers/ToolGroupContainer.js";
export type { ThreadGroupPart } from "./containers/ToolGroupContainer.js";
export { ReasoningContainer } from "./containers/ReasoningContainer.js";
export { ComposerContainer } from "./containers/ComposerContainer.js";
export { AskUserContainer } from "./containers/AskUserContainer.js";
export { McpAuthContainer } from "./containers/McpAuthContainer.js";
export {
    ComposerAttachmentsContainer,
    ComposerAttachmentPickerContainer,
} from "./containers/AttachmentsContainer.js";
export { ThreadListContainer } from "./containers/ThreadListContainer.js";
export { ErrorToasterProvider, useErrorToaster } from "./containers/ErrorToasterContainer.js";
export { Thread } from "./containers/Thread.js";
