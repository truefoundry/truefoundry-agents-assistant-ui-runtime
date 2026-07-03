import type { StoredAuth } from "@/lib/auth/types";

const AUTH_STORAGE_KEY = "tf_auth_v1";
const TENANT_NAME_STORAGE_KEY = "tf_tenant_name_v1";
const LAST_TENANT_STORAGE_KEY = "tf_last_tenant_v1";

export function readStoredAuth(): StoredAuth | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredAuth;
    } catch {
        return null;
    }
}

export function writeStoredAuth(auth: StoredAuth): void {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth(): void {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function readCachedTenantName(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(TENANT_NAME_STORAGE_KEY) ?? "";
}

export function writeCachedTenantName(tenantName: string): void {
    window.localStorage.setItem(TENANT_NAME_STORAGE_KEY, tenantName);
}

export function readLastTenantName(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(LAST_TENANT_STORAGE_KEY) ?? "";
}

export function writeLastTenantName(tenantName: string): void {
    window.localStorage.setItem(LAST_TENANT_STORAGE_KEY, tenantName);
}

let inMemoryPat: string | null = null;

export function getInMemoryPat(): string | null {
    return inMemoryPat;
}

export function setInMemoryPat(pat: string | null): void {
    inMemoryPat = pat;
}
