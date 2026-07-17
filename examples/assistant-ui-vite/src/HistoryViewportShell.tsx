import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithRef,
} from "react";
import { ThreadViewportShell } from "@truefoundry/agent-ui-sdk";
import { useTrueFoundryHistoryPagination } from "@truefoundry/assistant-ui-runtime";

type ThreadViewportShellProps = ComponentPropsWithRef<"div"> & {
  isEmpty?: boolean;
};

/** How close to the top (px) before we fetch the next older history page. */
const TOP_THRESHOLD_PX = 200;

/**
 * Drop-in override for the `ThreadViewportShell` slot: same markup as the
 * default atom, plus a top sentinel that loads older history when the user
 * scrolls near the top. Scroll position is preserved across the prepend.
 */
export const HistoryViewportShell = forwardRef<
  HTMLDivElement,
  ThreadViewportShellProps
>(({ children, ...rest }, forwardedRef) => {
  const { hasOlderHistory, isLoadingOlderHistory, loadOlderHistory } =
    useTrueFoundryHistoryPagination();

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef != null) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const maybeLoadOlder = useCallback(async () => {
    const viewport = viewportRef.current;
    if (viewport == null || loadingRef.current || !hasOlderHistory) {
      return;
    }
    loadingRef.current = true;

    const prevScrollHeight = viewport.scrollHeight;
    const prevScrollTop = viewport.scrollTop;

    try {
      await loadOlderHistory();
      // Wait for React to commit the prepended messages, then restore the
      // user's anchor so the list doesn't jump to the oldest message.
      requestAnimationFrame(() => {
        const el = viewportRef.current;
        if (el == null) {
          return;
        }
        const delta = el.scrollHeight - prevScrollHeight;
        if (delta > 0) {
          el.scrollTo({ top: prevScrollTop + delta, behavior: "instant" });
        }
      });
    } catch {
      // Runtime surfaces the error via onError; the sentinel stays retryable.
    } finally {
      loadingRef.current = false;
    }
  }, [hasOlderHistory, loadOlderHistory]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const sentinel = sentinelRef.current;
    if (viewport == null || sentinel == null || !hasOlderHistory) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void maybeLoadOlder();
        }
      },
      { root: viewport, rootMargin: `${TOP_THRESHOLD_PX}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlderHistory, maybeLoadOlder]);

  return (
    <ThreadViewportShell ref={setViewportRef} {...rest}>
      {hasOlderHistory && (
        <div ref={sentinelRef} className="flex justify-center py-2">
          <span className="text-xs text-muted-foreground">
            {isLoadingOlderHistory
              ? "Loading older messages…"
              : "Scroll up to load older messages"}
          </span>
        </div>
      )}
      {children}
    </ThreadViewportShell>
  );
});
HistoryViewportShell.displayName = "HistoryViewportShell";
