"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { XIcon } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { TrueFoundryGatewayError } from "truefoundry-gateway-sdk";

import { cn } from "@/lib/utils";

type ErrorToastContent = {
  title: string;
  description: string;
};

type ErrorToasterContextValue = {
  showError: (error: unknown) => void;
};

const ErrorToasterContext = createContext<ErrorToasterContextValue | null>(null);

const TOAST_DURATION_MS = Number.POSITIVE_INFINITY;

function formatErrorBody(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

function normalizeError(error: unknown): ErrorToastContent {
  if (error instanceof TrueFoundryGatewayError) {
    const statusCode = error.statusCode;
    const title =
      statusCode != null ? `Request failed (${statusCode})` : "Request failed";
    const description =
      formatErrorBody(error.body) ??
      (error.message || "The gateway returned an error.");
    return { title, description };
  }

  if (error instanceof Error) {
    return {
      title: "Something went wrong",
      description: error.message || "An unexpected error occurred.",
    };
  }

  return {
    title: "Something went wrong",
    description: String(error),
  };
}

export function ErrorToasterProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ErrorToastContent | null>(null);
  const [open, setOpen] = useState(false);

  const showError = useCallback((error: unknown) => {
    setToast(normalizeError(error));
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ showError }), [showError]);

  return (
    <ErrorToasterContext.Provider value={value}>
      <ToastPrimitive.Provider duration={TOAST_DURATION_MS}>
        {children}
        {toast != null ? (
          <ToastPrimitive.Root
            open={open}
            onOpenChange={setOpen}
            className={cn(
              "pointer-events-auto relative flex w-full max-h-[min(70vh,32rem)] items-start gap-3 rounded-xl border border-destructive bg-background p-4 text-destructive shadow-lg dark:bg-card dark:text-red-200",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-4",
            )}
          >
            <div className="grid min-h-0 min-w-0 flex-1 gap-1 overflow-y-auto pe-6">
              <ToastPrimitive.Title className="text-sm font-semibold leading-none">
                {toast.title}
              </ToastPrimitive.Title>
              <ToastPrimitive.Description className="text-sm whitespace-pre-wrap break-words font-mono">
                {toast.description}
              </ToastPrimitive.Description>
            </div>
            <ToastPrimitive.Close className="absolute top-3 right-3 rounded-md p-1 text-destructive transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ) : null}
        <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-0 z-50 flex max-h-screen flex-col-reverse gap-2 p-4 sm:bottom-4 sm:left-1/2 sm:w-full sm:max-w-2xl sm:-translate-x-1/2" />
      </ToastPrimitive.Provider>
    </ErrorToasterContext.Provider>
  );
}

export function useErrorToaster(): ErrorToasterContextValue {
  const context = useContext(ErrorToasterContext);
  if (context == null) {
    throw new Error("useErrorToaster must be used within ErrorToasterProvider");
  }
  return context;
}
