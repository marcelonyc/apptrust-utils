import { apiClient } from "./client";

export interface RuleParameter {
    name: string;
    value: string;
}

export interface RulePayload {
    template_id: number;
    name: string;
    description?: string;
    is_custom: boolean;
    version: string;
    parameters: RuleParameter[];
    commit_message: string;
    author: string;
}

export interface Rule extends Omit<RulePayload, "commit_message" | "author"> {
    id: number;
    status: "draft" | "published";
    remote_id?: string;
    created_at: string;
    updated_at: string;
}

export interface RuleVersion {
    id: number;
    rule_id: number;
    version_ref: string;
    message: string;
    author: string;
    data: Record<string, unknown>;
    created_at: string;
    parent_id?: number;
    is_published: boolean;
}

export interface PublishResult {
    remote_id: string;
    version_ref: string;
    published_at: string;
}

export interface RuleDiff {
    version_a: string;
    version_b: string;
    diff: string[];
}

export const listRules = async (): Promise<Rule[]> => {
    const response = await apiClient.get<Rule[]>("/rules");
    return response.data;
};

export const createRule = async (payload: RulePayload): Promise<Rule> => {
    const response = await apiClient.post<Rule>("/rules", payload);
    return response.data;
};

export const updateRule = async (id: number, payload: RulePayload): Promise<Rule> => {
    const response = await apiClient.put<Rule>(`/rules/${id}`, payload);
    return response.data;
};

export const deleteRule = async (id: number): Promise<void> => {
    await apiClient.delete(`/rules/${id}`);
};

export const publishRule = async (id: number): Promise<PublishResult> => {
    const response = await apiClient.post<PublishResult>(`/rules/${id}/publish`);
    return response.data;
};

export const listRuleVersions = async (id: number): Promise<RuleVersion[]> => {
    const response = await apiClient.get<RuleVersion[]>(`/rules/${id}/versions`);
    return response.data;
};

export const diffRuleVersion = async (
    ruleId: number,
    versionId: number,
    compareTo?: number
): Promise<RuleDiff> => {
    const response = await apiClient.get<RuleDiff>(
        `/rules/${ruleId}/versions/${versionId}/diff`,
        { params: compareTo ? { compare_to: compareTo } : undefined }
    );
    return response.data;
};
