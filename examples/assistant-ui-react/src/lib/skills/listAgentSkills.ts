import { cpFetch } from "@/lib/auth/cpFetch";

export interface AgentSkill {
    id: string;
    versionId: string;
    name: string;
    mlRepo: string;
    fqn: string;
    description?: string;
}

interface RawSkillManifest {
    ml_repo?: string;
    version?: number;
    source?: { description?: string };
}

interface RawSkillVersion {
    id?: string;
    fqn?: string;
    manifest?: RawSkillManifest;
}

interface RawAgentSkill {
    id?: string;
    ml_repo_id?: string;
    name?: string;
    fqn?: string;
    latest_version?: RawSkillVersion;
}

function normalizeSkill(row: RawAgentSkill): AgentSkill | null {
    const latest = row.latest_version;
    const fqn = latest?.fqn?.trim();
    const versionId = latest?.id?.trim();
    const id = row.id?.trim();
    const name = row.name?.trim();
    if (!fqn || !versionId || !id || !name || latest == null) return null;

    const manifest = latest.manifest;
    return {
        id,
        versionId,
        name,
        mlRepo: manifest?.ml_repo ?? "",
        fqn,
        description: manifest?.source?.description,
    };
}

export async function listAgentSkills(
    cpUrl: string,
    token: string,
): Promise<AgentSkill[]> {
    const response = await cpFetch(
        `${cpUrl}/api/ml/v1/agent-skills?include_empty_agent_skills=false`,
        token,
    );
    if (!response.ok) {
        throw new Error(`Failed to list agent skills (${response.status})`);
    }

    const json = (await response.json()) as { data?: RawAgentSkill[] };
    const skills = (json.data ?? [])
        .map(normalizeSkill)
        .filter((skill): skill is AgentSkill => skill != null);

    return skills.sort((a, b) => a.name.localeCompare(b.name));
}
