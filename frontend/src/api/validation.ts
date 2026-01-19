import { apiClient } from "./client";

export interface RegoValidationResult {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
}

export interface RegoEvaluationResult {
    result: unknown;
    errors?: string[];
    warnings?: string[];
    command?: string;
}

export const validateRego = async (rego: string): Promise<RegoValidationResult> => {
    const response = await apiClient.post<RegoValidationResult>("/validation/rego", { rego });
    return response.data;
};

export const evaluateRego = async (
    rego: string,
    input: unknown
): Promise<RegoEvaluationResult> => {
    const response = await apiClient.post<RegoEvaluationResult>("/validation/rego/eval", { rego, input });
    return response.data;
};
