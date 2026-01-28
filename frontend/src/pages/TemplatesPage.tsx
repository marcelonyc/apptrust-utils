import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Template,
    TemplateDiff,
    TemplateParameter,
    TemplatePayload,
    TemplateVersion,
    createTemplate,
    deleteTemplate,
    diffTemplateVersion,
    listTemplateVersions,
    listTemplates,
    publishTemplate,
    updateTemplate
} from "../api/templates";
import { listRules } from "../api/rules";
import RegoEditor from "../components/RegoEditor";
import EvalResultModal from "../components/EvalResultModal";
import { evaluateRego } from "../api/validation";

const CATEGORY_OPTIONS = ["security", "legal", "operational", "quality", "audit", "workflow"];
const DATA_SOURCE_OPTIONS = ["evidence", "noop"];

const extractParamsFromRego = (rego: string): string[] => {
    const regex = /input\.params\.([a-zA-Z0-9_]+)/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rego)) !== null) {
        found.add(match[1]);
    }
    return Array.from(found);
};

/**
 * Transforms a predicate JSON by extracting data.releaseBundleVersion.getVersion
 * and wrapping it in { "data": ... }
 */
const transformPredicateData = (jsonString: string): string => {
    try {
        const parsed = JSON.parse(jsonString);

        // Check if the structure matches data.releaseBundleVersion.getVersion
        if (parsed?.data?.releaseBundleVersion?.getVersion) {
            const extractedData = parsed.data.releaseBundleVersion.getVersion;
            const transformed = { data: extractedData };
            return JSON.stringify(transformed, null, 2);
        }

        // If structure doesn't match, return original
        return jsonString;
    } catch (error) {
        // If JSON parsing fails, return original string
        return jsonString;
    }
};

const defaultTemplate: TemplatePayload = {
    name: "",
    description: "",
    category: "security",
    data_source_type: "evidence",
    version: "0.1.0",
    rego: "package example.policy\n\nimport rego.v1\n\ndefault allow := false\n",
    parameters: [],
    scanners: [],
    commit_message: "Initial draft",
    author: "system"
};

const TemplatesPage = () => {
    const queryClient = useQueryClient();
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [formState, setFormState] = useState<TemplatePayload>(defaultTemplate);
    const [diffResult, setDiffResult] = useState<TemplateDiff | null>(null);
    const [predicateText, setPredicateText] = useState<string>("{\n  \"data\": {}\n}");
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [evalBusy, setEvalBusy] = useState(false);
    const [evalFeedback, setEvalFeedback] = useState<string>("");
    const [modalOpen, setModalOpen] = useState(false);
    const [modalResult, setModalResult] = useState<unknown>(null);
    const [modalCommand, setModalCommand] = useState<string>("");
    const [modalWarnings, setModalWarnings] = useState<string[] | undefined>(undefined);

    const detectedParams = useMemo(() => extractParamsFromRego(formState.rego), [formState.rego]);

    const templatesQuery = useQuery({ queryKey: ["templates"], queryFn: listTemplates });

    const versionsQuery = useQuery({
        queryKey: ["template", selectedTemplate?.id, "versions"],
        queryFn: () => listTemplateVersions(selectedTemplate!.id),
        enabled: !!selectedTemplate
    });

    const createMutation = useMutation({
        mutationFn: createTemplate,
        onSuccess: (template) => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
            setSelectedTemplate(template);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: TemplatePayload }) => updateTemplate(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
            if (selectedTemplate) {
                queryClient.invalidateQueries({ queryKey: ["template", selectedTemplate.id, "versions"] });
            }
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
            setSelectedTemplate(null);
            setFormState(defaultTemplate);
            setDiffResult(null);
        }
    });

    const publishMutation = useMutation({
        mutationFn: publishTemplate,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
            if (selectedTemplate) {
                queryClient.invalidateQueries({ queryKey: ["template", selectedTemplate.id, "versions"] });
            }
            window.alert(`Template published as ${result.version_ref}.`);
        }
    });

    useEffect(() => {
        if (!selectedTemplate) {
            setFormState(defaultTemplate);
            setPredicateText("{\n  \"data\": {}\n}");
            return;
        }
        setFormState({
            name: selectedTemplate.name,
            description: selectedTemplate.description ?? "",
            category: selectedTemplate.category,
            data_source_type: selectedTemplate.data_source_type,
            version: selectedTemplate.version,
            rego: selectedTemplate.rego,
            parameters: selectedTemplate.parameters as TemplateParameter[],
            scanners: selectedTemplate.scanners,
            commit_message: "Update draft",
            author: "system"
        });
    }, [selectedTemplate]);

    useEffect(() => {
        setParamValues((prev) => {
            const next: Record<string, string> = {};
            detectedParams.forEach((param) => {
                next[param] = prev[param] ?? "";
            });
            return next;
        });
    }, [detectedParams]);

    const handleSelect = (template: Template) => {
        setSelectedTemplate(template);
        setDiffResult(null);
    };

    const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (selectedTemplate) {
            updateMutation.mutate({ id: selectedTemplate.id, payload: formState });
        } else {
            createMutation.mutate(formState);
        }
    };

    const handleEvaluateRego = async () => {
        setEvalFeedback("");
        let parsedInput: unknown;
        try {
            parsedInput = JSON.parse(predicateText);
        } catch (error) {
            setEvalFeedback("Predicate must be valid JSON.");
            return;
        }

        const mergedInput = {
            ...(parsedInput as Record<string, unknown>),
            params: {
                ...((parsedInput as Record<string, any>)?.params ?? {}),
                ...paramValues
            }
        };

        setEvalBusy(true);
        try {
            const result = await evaluateRego(formState.rego, mergedInput);
            if (result.errors?.length) {
                setEvalFeedback(`Evaluation failed: ${result.errors.join(" • ")}`);
                return;
            }
            setModalResult(result.result ?? null);
            setModalCommand(result.command ?? "");
            setModalWarnings(result.warnings);
            setModalOpen(true);
            setEvalFeedback("Evaluation succeeded.");
        } catch (error) {
            setEvalFeedback("Evaluation request failed. Check backend logs.");
        } finally {
            setEvalBusy(false);
        }
    };

    const handleDeleteTemplate = async (templateId: number) => {
        try {
            // Fetch all rules to check for dependencies
            const rules = await listRules();
            const dependentRules = rules.filter(rule => rule.template_id === templateId);

            if (dependentRules.length > 0) {
                const ruleNames = dependentRules.map(rule => `• ${rule.name}`).join("\n");
                window.alert(
                    `Cannot delete this template. It is currently used by ${dependentRules.length} rule(s):\n\n${ruleNames}\n\nPlease delete or reassign these rules before deleting the template.`
                );
                return;
            }

            // No dependencies, proceed with delete
            if (window.confirm("Delete this template?")) {
                deleteMutation.mutate(templateId);
            }
        } catch (error) {
            window.alert("Failed to check template dependencies. Please try again.");
        }
    };

    const handleAddParameter = () => {
        setFormState((prev) => ({
            ...prev,
            parameters: [...prev.parameters, { name: "", type: "string", description: "" }]
        }));
    };

    const handleParameterChange = (index: number, field: keyof TemplateParameter, value: string) => {
        setFormState((prev) => {
            const next = [...prev.parameters];
            next[index] = { ...next[index], [field]: value };
            return { ...prev, parameters: next };
        });
    };

    const handleRemoveParameter = (index: number) => {
        setFormState((prev) => {
            const next = prev.parameters.filter((_, idx) => idx !== index);
            return { ...prev, parameters: next };
        });
    };

    const scannersInput = useMemo(() => formState.scanners.join(", "), [formState.scanners]);

    const onChangeScanners = (value: string) => {
        const tokens = value
            .split(",")
            .map((token) => token.trim())
            .filter(Boolean);
        setFormState((prev) => ({ ...prev, scanners: tokens }));
    };

    const handleDiff = async (version: TemplateVersion) => {
        if (!selectedTemplate) {
            return;
        }
        const result = await diffTemplateVersion(selectedTemplate.id, version.id, undefined);
        setDiffResult(result);
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px" }}>
            <section style={{ background: "white", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h2 style={{ margin: 0, fontSize: "18px" }}>Templates</h2>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedTemplate(null);
                            setFormState(defaultTemplate);
                            setDiffResult(null);
                        }}
                        style={{
                            background: "#0ea5e9",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            padding: "6px 10px",
                            fontSize: "13px"
                        }}
                    >
                        New
                    </button>
                </div>
                {templatesQuery.isLoading && <p>Loading templates...</p>}
                {templatesQuery.error && <p>Error loading templates.</p>}
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {templatesQuery.data?.map((template) => {
                        const isActive = selectedTemplate?.id === template.id;
                        return (
                            <li
                                key={template.id}
                                style={{
                                    border: "1px solid",
                                    borderColor: isActive ? "#0ea5e9" : "#d1d5db",
                                    borderRadius: "6px",
                                    padding: "10px",
                                    background: isActive ? "rgba(14,165,233,0.08)" : "white",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "8px"
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleSelect(template)}
                                    style={{
                                        textAlign: "left",
                                        flex: 1,
                                        background: "none",
                                        border: "none",
                                        fontSize: "14px",
                                        color: "#0f172a"
                                    }}
                                >
                                    <strong>{template.name}</strong>
                                    <div style={{ fontSize: "12px", color: "#64748b" }}>v{template.version} • {template.status}</div>
                                </button>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <button
                                        type="button"
                                        onClick={() => publishMutation.mutate(template.id)}
                                        disabled={publishMutation.isPending}
                                        style={{
                                            background: "#22c55e",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "4px",
                                            fontSize: "12px",
                                            padding: "4px 8px"
                                        }}
                                    >
                                        Publish
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleDeleteTemplate(template.id);
                                        }}
                                        style={{
                                            background: "#ef4444",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "4px",
                                            fontSize: "12px",
                                            padding: "4px 8px"
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <form
                    onSubmit={handleFormSubmit}
                    style={{
                        background: "white",
                        padding: "18px",
                        borderRadius: "12px",
                        boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px"
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: "18px" }}>{selectedTemplate ? "Edit Template" : "Create Template"}</h2>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span>Name</span>
                        <input
                            required
                            value={formState.name}
                            onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                        />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span>Description</span>
                        <textarea
                            value={formState.description}
                            onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5", minHeight: "72px" }}
                        />
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span>Category</span>
                            <select
                                required
                                value={formState.category}
                                onChange={(event) => setFormState({ ...formState, category: event.target.value })}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            >
                                {CATEGORY_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span>Data Source</span>
                            <select
                                required
                                value={formState.data_source_type}
                                onChange={(event) =>
                                    setFormState({ ...formState, data_source_type: event.target.value })
                                }
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            >
                                {DATA_SOURCE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span>Version</span>
                            <input
                                required
                                value={formState.version}
                                onChange={(event) => setFormState({ ...formState, version: event.target.value })}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            />
                        </label>
                    </div>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span>Scanners (comma-separated)</span>
                        <input
                            value={scannersInput}
                            onChange={(event) => onChangeScanners(event.target.value)}
                            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                        />
                    </label>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0, fontSize: "16px" }}>Parameters</h3>
                        <button
                            type="button"
                            onClick={handleAddParameter}
                            style={{
                                background: "#6366f1",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "13px",
                                padding: "4px 10px"
                            }}
                        >
                            Add parameter
                        </button>
                    </div>
                    {formState.parameters.length === 0 && <p style={{ fontSize: "13px" }}>No parameters defined.</p>}
                    {formState.parameters.map((parameter, index) => (
                        <div
                            key={index}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, minmax(0, 1fr)) 32px",
                                gap: "8px",
                                alignItems: "center"
                            }}
                        >
                            <input
                                required
                                placeholder="Name"
                                value={parameter.name}
                                onChange={(event) => handleParameterChange(index, "name", event.target.value)}
                                style={{ padding: "6px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            />
                            <input
                                required
                                placeholder="Type"
                                value={parameter.type}
                                onChange={(event) => handleParameterChange(index, "type", event.target.value)}
                                style={{ padding: "6px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            />
                            <input
                                placeholder="Description"
                                value={parameter.description ?? ""}
                                onChange={(event) => handleParameterChange(index, "description", event.target.value)}
                                style={{ padding: "6px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            />
                            <button
                                type="button"
                                onClick={() => handleRemoveParameter(index)}
                                style={{
                                    background: "#ef4444",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "6px"
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <div>
                        <h3 style={{ marginBottom: "8px", fontSize: "16px" }}>Rego Policy</h3>
                        <RegoEditor value={formState.rego} onChange={(value) => setFormState({ ...formState, rego: value })} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px" }}>Attestation (Exported from AppTrust)</h3>
                        <textarea
                            value={predicateText}
                            onChange={(event) => {
                                const transformedText = transformPredicateData(event.target.value);
                                setPredicateText(transformedText);
                            }}
                            placeholder="Paste predicate JSON here"
                            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5", minHeight: "120px" }}
                        />
                        {detectedParams.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <strong style={{ fontSize: "14px" }}>Detected Parameters</strong>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                                    {detectedParams.map((param) => (
                                        <label key={param} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                            <span>{param}</span>
                                            <input
                                                value={paramValues[param] ?? ""}
                                                onChange={(event) =>
                                                    setParamValues((prev) => ({ ...prev, [param]: event.target.value }))
                                                }
                                                placeholder="Parameter value"
                                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <button
                                type="button"
                                onClick={handleEvaluateRego}
                                disabled={evalBusy}
                                style={{
                                    backgroundColor: "#0ea5e9",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "8px 12px",
                                    fontSize: "13px"
                                }}
                            >
                                {evalBusy ? "Evaluating..." : "Evaluate Rego"}
                            </button>
                            {evalFeedback && <span style={{ fontSize: "13px", color: "#334155" }}>{evalFeedback}</span>}
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span>Commit message</span>
                            <input
                                required
                                value={formState.commit_message}
                                onChange={(event) => setFormState({ ...formState, commit_message: event.target.value })}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span>Author</span>
                            <input
                                required
                                value={formState.author}
                                onChange={(event) => setFormState({ ...formState, author: event.target.value })}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            />
                        </label>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                        {selectedTemplate && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedTemplate(null);
                                    setFormState(defaultTemplate);
                                }}
                                style={{
                                    background: "#e2e8f0",
                                    border: "none",
                                    borderRadius: "6px",
                                    padding: "8px 16px",
                                    fontSize: "14px"
                                }}
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                            style={{
                                background: "#0ea5e9",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                padding: "10px 18px",
                                fontSize: "14px"
                            }}
                        >
                            {selectedTemplate ? "Save changes" : "Create template"}
                        </button>
                    </div>
                </form>
                {selectedTemplate && (
                    <div
                        style={{
                            background: "white",
                            padding: "16px",
                            borderRadius: "12px",
                            boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
                            display: "grid",
                            gridTemplateColumns: "280px 1fr",
                            gap: "16px"
                        }}
                    >
                        <div>
                            <h3 style={{ marginTop: 0, fontSize: "16px" }}>Version history</h3>
                            {versionsQuery.isLoading && <p>Loading versions...</p>}
                            {versionsQuery.data && versionsQuery.data.length === 0 && <p>No versions recorded yet.</p>}
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                                {versionsQuery.data?.map((version) => (
                                    <li
                                        key={version.id}
                                        style={{
                                            border: "1px solid #d1d5db",
                                            borderRadius: "8px",
                                            padding: "10px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "6px",
                                            background: version.is_published ? "rgba(34,197,94,0.12)" : "white"
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{version.version_ref}</div>
                                        <div style={{ fontSize: "12px", color: "#475569" }}>{version.message}</div>
                                        <button
                                            type="button"
                                            onClick={() => handleDiff(version)}
                                            style={{
                                                alignSelf: "flex-start",
                                                background: "#334155",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "4px",
                                                padding: "4px 8px",
                                                fontSize: "12px"
                                            }}
                                        >
                                            Diff with previous
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 style={{ marginTop: 0, fontSize: "16px" }}>Diff preview</h3>
                            {diffResult ? (
                                <pre
                                    style={{
                                        background: "#0f172a",
                                        color: "#e2e8f0",
                                        padding: "12px",
                                        borderRadius: "8px",
                                        maxHeight: "260px",
                                        overflow: "auto",
                                        fontSize: "12px"
                                    }}
                                >
                                    {diffResult.diff.length > 0 ? diffResult.diff.join("\n") : "No changes"}
                                </pre>
                            ) : (
                                <p style={{ fontSize: "13px" }}>Select a version to compare changes.</p>
                            )}
                        </div>
                    </div>
                )}
            </section>
            {modalOpen && (
                <EvalResultModal
                    result={modalResult}
                    command={modalCommand}
                    warnings={modalWarnings}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </div>
    );
};

export default TemplatesPage;
