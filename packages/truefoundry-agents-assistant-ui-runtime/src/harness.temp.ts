/**
 * TEMP — Harness / backend wire shapes for model-provider and MCP catalogs.
 *
 * Not part of the published FE contract. The gateway adapter (and these types)
 * will live outside this repo; keep this file only as a scratch reference for
 * hosts mapping wire → FE `CatalogServer` bases in `server/types.ts`.
 *
 * Do not import from package public exports.
 */

import type { ProviderType } from "./server/types.js";

// ---------------------------------------------------------------------------
// Models — harness wire
// ---------------------------------------------------------------------------

export interface HarnessModelProperties {
    contextLength: number;
    maxOutputTokens: number;
    reasoningEfforts?: string[];
}

/** Model row as returned/accepted by the harness model-provider APIs. */
export interface HarnessModelEntry {
    modelId: string;
    name: string;
    properties: HarnessModelProperties;
}

export type HarnessModelProviderAuthWrite = { apiKey: string };
export type HarnessModelProviderAuthRead = { apiKeySet: true };

export interface HarnessModelProviderCatalogEntry {
    /** Builtin catalog type — never `"custom"`. */
    type: ProviderType;
    name: string;
    models: HarnessModelEntry[];
}

export interface HarnessModelProviderBase {
    type: ProviderType;
    name: string;
    /** Present iff `type === "custom"`. */
    baseUrl?: string;
    models: HarnessModelEntry[];
}

export type HarnessUpdateModelProviderRequest = HarnessModelProviderBase & {
    auth: HarnessModelProviderAuthWrite;
};

export type HarnessModelProvider = HarnessModelProviderBase & {
    auth: HarnessModelProviderAuthRead;
};

/** Flat FQN read view for GET /models. */
export interface HarnessCatalogModel {
    /** `${providerName}/${model.name}` */
    name: string;
    modelId: string;
    properties: HarnessModelProperties;
}

// ---------------------------------------------------------------------------
// MCP — harness wire
// ---------------------------------------------------------------------------

export type HarnessMcpServerAuth = { type: "dcr" };

export interface HarnessMcpServerCatalogEntry {
    provider: string;
    name: string;
    url: string;
    auth?: HarnessMcpServerAuth;
}

export type HarnessMcpServerAuthStatus =
    | { status: "authenticated" }
    | { status: "authRequired"; authorizationUrl: string };

export interface HarnessConfiguredMcpServer extends HarnessMcpServerCatalogEntry {
    authStatus: HarnessMcpServerAuthStatus;
}

export type HarnessUpdateMcpServerRequest = HarnessMcpServerCatalogEntry;
