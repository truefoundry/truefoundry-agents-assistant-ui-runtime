import { cpFetch } from "@/lib/auth/cpFetch";

interface RawAgentManifest {
    name?: string;
    title?: string;
    description?: string;
    model?: { name?: string; params?: Record<string, unknown> };
    instruction?: string;
    tags?: string[];
    skills?: { fqn: string; name?: string }[];
    mcp_servers?: { name: string; displayName?: string; display_name?: string }[];
    model_params?: {
        max_tokens?: number;
        temperature?: number;
        reasoning_effort?: "minimal" | "low" | "medium" | "high";
    };
    iteration_limit?: number;
    sandbox?: { enabled?: boolean };
    sample_inputs?: { text?: string; variables?: Record<string, string> }[];
    source?: { description?: string };
}

interface RawSubject {
    subjectSlug?: string;
    subjectDisplayName?: string;
}

interface RawAgentVersion {
    id?: string;
    fqn?: string;
    manifest?: RawAgentManifest;
    updatedAt?: string;
    createdBySubject?: RawSubject;
}

interface RawAgent {
    id: string;
    name: string;
    fqn?: string;
    updatedAt?: string;
    createdBy?: string;
    createdBySubject?: RawSubject;
    manifest?: RawAgentManifest;
    latestVersionDetails?: RawAgentVersion;
}

export interface SampleAgent {
    id: string;
    name: string;
    fqn?: string;
    versionId?: string;
    versionFqn?: string;
    title: string;
    description: string;
    model: string;
    instruction: string;
    tags: string[];
    skills: { fqn: string; name: string }[];
    mcp_servers: { name: string; displayName: string }[];
    model_params: {
        max_tokens?: number;
        temperature?: number;
        reasoning_effort?: string;
    };
    iteration_limit?: number;
    sandbox?: { enabled: boolean };
    sampleInputs?: { text?: string; variables?: Record<string, string> }[];
    publishedBy?: { name: string; email: string };
    updatedAt: string;
}

function toDisplayName(value: string | undefined): string {
    if (!value) return "Untitled agent";
    return value
        .split(/[-_]/)
        .filter(Boolean)
        .map((word) => word[0]!.toUpperCase() + word.slice(1))
        .join(" ");
}

function lastColonSegment(fqn: string): string {
    const parts = fqn.split(":");
    return parts[parts.length - 1] ?? fqn;
}

function normalizeAgent(raw: RawAgent): SampleAgent {
    const version = raw.latestVersionDetails;
    const manifest = version?.manifest ?? raw.manifest ?? {};
    const subject = version?.createdBySubject ?? raw.createdBySubject;

    return {
        id: raw.id,
        name: raw.name,
        fqn: raw.fqn,
        versionId: version?.id,
        versionFqn: version?.fqn,
        title: manifest.title ?? toDisplayName(manifest.name ?? raw.name),
        description: manifest.description ?? manifest.source?.description ?? "",
        model: manifest.model?.name ?? "",
        instruction: manifest.instruction ?? "",
        tags: manifest.tags ?? [],
        skills: (manifest.skills ?? []).map((skill) => ({
            fqn: skill.fqn,
            name: skill.name ?? lastColonSegment(skill.fqn),
        })),
        mcp_servers: (manifest.mcp_servers ?? []).map((mcp) => ({
            name: mcp.name,
            displayName: mcp.displayName ?? mcp.display_name ?? toDisplayName(mcp.name),
        })),
        model_params: manifest.model?.params ?? manifest.model_params ?? {},
        iteration_limit: manifest.iteration_limit,
        sandbox: manifest.sandbox?.enabled != null ? { enabled: manifest.sandbox.enabled } : undefined,
        sampleInputs: manifest.sample_inputs,
        publishedBy:
            subject != null
                ? {
                      name: subject.subjectDisplayName ?? subject.subjectSlug ?? "",
                      email: subject.subjectSlug ?? "",
                  }
                : raw.createdBy
                  ? { name: raw.createdBy, email: raw.createdBy }
                  : undefined,
        updatedAt: version?.updatedAt ?? raw.updatedAt ?? new Date().toISOString(),
    };
}

export async function listAgents(cpUrl: string, token: string): Promise<SampleAgent[]> {
    const response = await cpFetch(
        `${cpUrl}/api/svc/v1/agents?limit=50&offset=0&namePrefix=`,
        token,
    );
    if (!response.ok) {
        throw new Error(`Failed to list agents: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as { data: RawAgent[] };
    return body.data.map(normalizeAgent);
}
