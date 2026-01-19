import { apiClient } from "./client";

export interface TemplateParameter {
    name: string;
    type: string;
    description?: string;
}

export interface TemplatePayload {
    name: string;
    description?: string;
    category: string;
    data_source_type: string;
    version: string;
    rego: string;
    parameters: TemplateParameter[];
    scanners: string[];
    commit_message: string;
    author: string;
}

export interface Template extends Omit<TemplatePayload, "commit_message" | "author"> {
    id: number;
    status: "draft" | "published";
    remote_id?: string;
    created_at: string;
    updated_at: string;
}

export interface TemplateVersion {
    id: number;
    template_id: number;
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

export interface TemplateDiff {
    version_a: string;
    version_b: string;
    diff: string[];
}

export const listTemplates = async (): Promise<Template[]> => {
    const response = await apiClient.get<Template[]>("/templates");
    return response.data;
};

export const createTemplate = async (payload: TemplatePayload): Promise<Template> => {
    const response = await apiClient.post<Template>("/templates", payload);
    return response.data;
};

export const updateTemplate = async (id: number, payload: TemplatePayload): Promise<Template> => {
    const response = await apiClient.put<Template>(`/templates/${id}`, payload);
    return response.data;
};

export const deleteTemplate = async (id: number): Promise<void> => {
    await apiClient.delete(`/templates/${id}`);
};

export const publishTemplate = async (id: number): Promise<PublishResult> => {
    const response = await apiClient.post<PublishResult>(`/templates/${id}/publish`);
    return response.data;
};

export const listTemplateVersions = async (id: number): Promise<TemplateVersion[]> => {
    const response = await apiClient.get<TemplateVersion[]>(`/templates/${id}/versions`);
    return response.data;
};

export const diffTemplateVersion = async (
    templateId: number,
    versionId: number,
    compareTo?: number
): Promise<TemplateDiff> => {
    const response = await apiClient.get<TemplateDiff>(
        `/templates/${templateId}/versions/${versionId}/diff`,
        { params: compareTo ? { compare_to: compareTo } : undefined }
    );
    return response.data;
};
