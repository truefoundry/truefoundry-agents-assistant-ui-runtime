"use client";

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { detectAuthMode, getControlPlaneHostname, getControlPlaneUrl } from "@/lib/auth/config";
import { setAuthMode } from "@/lib/auth/cpFetch";
import {
    bounceToSignIn,
    fetchPersonalAccessToken,
    logout as cookieLogout,
    probeSession,
} from "@/lib/auth/cookieAuth";
import {
    isExpired,
    pollForToken,
    requestDeviceAuthorize,
    resolveTenantName,
    scheduleRefresh,
    toStoredAuth,
} from "@/lib/auth/deviceAuth";
import {
    clearStoredAuth,
    getInMemoryPat,
    readCachedTenantName,
    readStoredAuth,
    writeCachedTenantName,
    writeStoredAuth,
} from "@/lib/auth/storage";
import type { AuthMode, AuthStatus, DeviceAuthorizeResponse } from "@/lib/auth/types";

interface AuthContextValue {
    mode: AuthMode;
    status: AuthStatus;
    token: string;
    tenantName: string;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (context == null) {
        throw new Error("useAuth must be used within an AuthProvider.");
    }
    return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const mode = useMemo(() => detectAuthMode(), []);
    const cpUrl = useMemo(() => getControlPlaneUrl(), []);

    useEffect(() => {
        setAuthMode(mode);
    }, [mode]);

    if (mode === "device") {
        return (
            <DeviceAuthGate cpUrl={cpUrl} mode={mode}>
                {children}
            </DeviceAuthGate>
        );
    }
    return (
        <CookieAuthGate cpUrl={cpUrl} mode={mode}>
            {children}
        </CookieAuthGate>
    );
}

function DeviceAuthGate({
    cpUrl,
    mode,
    children,
}: {
    cpUrl: string;
    mode: AuthMode;
    children: ReactNode;
}) {
    const [status, setStatus] = useState<AuthStatus>("resolving");
    const [token, setToken] = useState<string>("");
    const [tenantName, setTenantName] = useState<string>("");
    const [deviceInfo, setDeviceInfo] = useState<DeviceAuthorizeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const cancelRef = useRef<AbortController | null>(null);
    const refreshCancelRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function start() {
            const stored = readStoredAuth();
            if (stored != null && !isExpired(stored)) {
                if (!cancelled) {
                    setToken(stored.accessToken);
                    setTenantName(stored.tenantName);
                    setStatus("ready");
                }
                refreshCancelRef.current = scheduleRefresh(
                    stored,
                    (refreshed) => {
                        writeStoredAuth(refreshed);
                        setToken(refreshed.accessToken);
                    },
                    (err) => {
                        clearStoredAuth();
                        setError(err instanceof Error ? err.message : "Session refresh failed.");
                        setStatus("resolving");
                    },
                );
                return;
            }

            try {
                const host = getControlPlaneHostname(cpUrl);
                const resolvedTenant =
                    stored?.tenantName ?? (await resolveTenantName(cpUrl, host));
                if (cancelled) return;
                setTenantName(resolvedTenant);
                writeCachedTenantName(resolvedTenant);

                const authorize = await requestDeviceAuthorize(cpUrl, resolvedTenant);
                if (cancelled) return;
                setDeviceInfo(authorize);
                setStatus("awaiting-device-approval");

                const controller = new AbortController();
                cancelRef.current = controller;
                const tokenResponse = await pollForToken({
                    cpUrl,
                    tenantName: resolvedTenant,
                    deviceCode: authorize.deviceCode,
                    intervalSeconds: authorize.intervalInSeconds,
                    expiresInSeconds: authorize.expiresInSeconds,
                    signal: controller.signal,
                });
                if (cancelled) return;

                const stored2 = toStoredAuth(cpUrl, resolvedTenant, tokenResponse);
                writeStoredAuth(stored2);
                setToken(stored2.accessToken);
                setStatus("ready");
                refreshCancelRef.current = scheduleRefresh(
                    stored2,
                    (refreshed) => {
                        writeStoredAuth(refreshed);
                        setToken(refreshed.accessToken);
                    },
                    (err) => {
                        clearStoredAuth();
                        setError(err instanceof Error ? err.message : "Session refresh failed.");
                        setStatus("resolving");
                    },
                );
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Failed to sign in.");
            }
        }

        void start();

        return () => {
            cancelled = true;
            cancelRef.current?.abort();
            refreshCancelRef.current?.();
        };
    }, [cpUrl]);

    async function logout() {
        refreshCancelRef.current?.();
        clearStoredAuth();
        window.location.reload();
    }

    if (status !== "ready") {
        return (
            <DeviceLoginScreen
                status={status}
                deviceInfo={deviceInfo}
                error={error}
                onRetry={() => window.location.reload()}
            />
        );
    }

    return (
        <AuthContext.Provider value={{ mode, status, token, tenantName, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

function DeviceLoginScreen({
    status,
    deviceInfo,
    error,
    onRetry,
}: {
    status: AuthStatus;
    deviceInfo: DeviceAuthorizeResponse | null;
    error: string | null;
    onRetry: () => void;
}) {
    return (
        <main className="flex h-dvh flex-col items-center justify-center gap-6 p-8">
            <div className="w-full max-w-lg space-y-4 text-center">
                <h1 className="text-xl font-semibold">Sign in to TrueFoundry</h1>
                {error != null ? (
                    <div className="space-y-3">
                        <p className="text-sm text-red-600">{error}</p>
                        <button
                            type="button"
                            onClick={onRetry}
                            className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
                        >
                            Try again
                        </button>
                    </div>
                ) : status === "awaiting-device-approval" && deviceInfo != null ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Approve this sign-in using the code below.
                        </p>
                        <p className="font-mono text-2xl tracking-widest">
                            {deviceInfo.userCode}
                        </p>
                        <a
                            href={deviceInfo.verificationURIComplete}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block rounded-md bg-foreground px-4 py-2 text-sm text-background"
                        >
                            Open approval page
                        </a>
                        <p className="text-xs text-muted-foreground">
                            Waiting for approval…
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Signing in…</p>
                )}
            </div>
        </main>
    );
}

function CookieAuthGate({
    cpUrl,
    mode,
    children,
}: {
    cpUrl: string;
    mode: AuthMode;
    children: ReactNode;
}) {
    const [status, setStatus] = useState<AuthStatus>("resolving");
    const [tenantName, setTenantName] = useState<string>("");
    const [token, setToken] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function start() {
            try {
                const host = getControlPlaneHostname(cpUrl);
                const cachedTenant = readCachedTenantName();
                const probe = await probeSession(cpUrl, host, cachedTenant);
                if (cancelled) return;

                if (probe.user == null) {
                    setStatus("redirecting");
                    bounceToSignIn(cpUrl, window.location.pathname);
                    return;
                }

                writeCachedTenantName(probe.user.tenantName);
                const pat = await fetchPersonalAccessToken(cpUrl, probe.user.id);
                if (cancelled) return;

                setTenantName(probe.user.tenantName);
                setToken(pat);
                setStatus("ready");
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Failed to sign in.");
            }
        }

        void start();
        return () => {
            cancelled = true;
        };
    }, [cpUrl]);

    async function logout() {
        await cookieLogout(cpUrl, tenantName);
    }

    if (status !== "ready") {
        return (
            <main className="flex h-dvh flex-col items-center justify-center gap-6 p-8">
                <div className="w-full max-w-lg space-y-4 text-center">
                    <h1 className="text-xl font-semibold">Sign in to TrueFoundry</h1>
                    {error != null ? (
                        <p className="text-sm text-red-600">{error}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {status === "redirecting" ? "Redirecting to sign in…" : "Checking session…"}
                        </p>
                    )}
                </div>
            </main>
        );
    }

    return (
        <AuthContext.Provider value={{ mode, status, token: token || getInMemoryPat() || "", tenantName, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
