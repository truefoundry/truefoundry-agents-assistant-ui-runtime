export type AuthMode = "device" | "cookie";

export interface StoredAuth {
    controlPlaneUrl: string;
    tenantName: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: number;
}

export interface DeviceAuthorizeResponse {
    userCode: string;
    deviceCode: string;
    verificationURI: string;
    verificationURIComplete: string;
    expiresInSeconds: number;
    intervalInSeconds: number;
}

export interface TokenResponse {
    accessToken: string;
    refreshToken: string | null;
}

export interface SessionUser {
    id: string;
    email: string;
    tenantName: string;
}

export interface SessionProbeResponse {
    user: SessionUser | null;
    tenantInfo?: { tenantName: string } | null;
}

export type AuthStatus =
    | "resolving"
    | "awaiting-device-approval"
    | "redirecting"
    | "ready";
