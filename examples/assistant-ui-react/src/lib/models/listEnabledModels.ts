import { cpFetch } from "@/lib/auth/cpFetch";

export interface ModelEntry {
    id: string;
    name: string;
    provider: string;
    providerAccount: string;
    apiModel: string;
    modelId: string;
}

interface RawEnabledModel {
    id?: string;
    name?: string;
    provider?: string;
    provider_account_name?: string;
    model_id?: string;
    model_fqn?: string;
    types?: string[];
}

function normalizeModel(row: RawEnabledModel): ModelEntry | null {
    const apiModel = row.model_fqn?.trim();
    const modelId = row.model_id?.trim();
    const name = row.name?.trim();
    const provider = row.provider?.trim();
    const providerAccount = row.provider_account_name?.trim();
    if (!apiModel || !modelId || !name || !provider || !providerAccount) {
        return null;
    }

    if (/virtual/i.test(provider)) {
        return null;
    }

    const types = row.types;
    if (types != null && types.length > 0 && !types.includes("chat")) {
        return null;
    }

    return {
        id: apiModel,
        name,
        provider,
        providerAccount,
        apiModel,
        modelId,
    };
}

export async function listEnabledModels(
    cpUrl: string,
    token: string,
): Promise<ModelEntry[]> {
    const response = await cpFetch(
        `${cpUrl}/api/svc/v1/llm-gateway/model/enabled`,
        token,
    );
    if (!response.ok) {
        throw new Error(`Failed to list enabled models (${response.status})`);
    }

    const json = (await response.json()) as Record<string, Record<string, RawEnabledModel[]>>;
    const models: ModelEntry[] = [];

    for (const accounts of Object.values(json)) {
        if (accounts == null || typeof accounts !== "object") continue;
        for (const accountModels of Object.values(accounts)) {
            if (!Array.isArray(accountModels)) continue;
            for (const row of accountModels) {
                const entry = normalizeModel(row);
                if (entry != null) {
                    models.push(entry);
                }
            }
        }
    }

    return models.sort((a, b) => a.name.localeCompare(b.name));
}
