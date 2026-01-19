import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Rule,
    RuleDiff,
    RuleParameter,
    RulePayload,
    RuleVersion,
    createRule,
    deleteRule,
    diffRuleVersion,
    listRuleVersions,
    listRules,
    publishRule,
    updateRule
} from "../api/rules";
import { listTemplates, Template } from "../api/templates";

const defaultRule: RulePayload = {
    template_id: 0,
    name: "",
    description: "",
    is_custom: true,
    version: "0.1.0",
    parameters: [],
    commit_message: "Initial draft",
    author: "system"
};

const RulesPage = () => {
    const queryClient = useQueryClient();
    const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
    const [formState, setFormState] = useState<RulePayload>(defaultRule);
    const [diffResult, setDiffResult] = useState<RuleDiff | null>(null);
    const templateId = formState.template_id;

    const rulesQuery = useQuery({ queryKey: ["rules"], queryFn: listRules });
    const templatesQuery = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
    const versionsQuery = useQuery({
        queryKey: ["rule", selectedRule?.id, "versions"],
        queryFn: () => listRuleVersions(selectedRule!.id),
        enabled: !!selectedRule
    });

    const createMutation = useMutation({
        mutationFn: createRule,
        onSuccess: (rule) => {
            queryClient.invalidateQueries({ queryKey: ["rules"] });
            setSelectedRule(rule);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: RulePayload }) => updateRule(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["rules"] });
            if (selectedRule) {
                queryClient.invalidateQueries({ queryKey: ["rule", selectedRule.id, "versions"] });
            }
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["rules"] });
            setSelectedRule(null);
            setFormState(defaultRule);
            setDiffResult(null);
        }
    });

    const publishMutation = useMutation({
        mutationFn: publishRule,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["rules"] });
            if (selectedRule) {
                queryClient.invalidateQueries({ queryKey: ["rule", selectedRule.id, "versions"] });
            }
            window.alert(`Rule published as ${result.version_ref}.`);
        }
    });

    useEffect(() => {
        if (!selectedRule) {
            setFormState(defaultRule);
            return;
        }
        setFormState({
            template_id: selectedRule.template_id,
            name: selectedRule.name,
            description: selectedRule.description ?? "",
            is_custom: selectedRule.is_custom,
            version: selectedRule.version,
            parameters: selectedRule.parameters as RuleParameter[],
            commit_message: "Update draft",
            author: "system"
        });
    }, [selectedRule]);

    const handleSelect = (rule: Rule) => {
        setSelectedRule(rule);
        setDiffResult(null);
    };

    const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!formState.template_id) {
            window.alert("Select a template before saving.");
            return;
        }
        if (selectedRule) {
            updateMutation.mutate({ id: selectedRule.id, payload: formState });
        } else {
            createMutation.mutate(formState);
        }
    };

    const handleAddParameter = () => {
        setFormState((prev) => ({
            ...prev,
            parameters: [...prev.parameters, { name: "", value: "" }]
        }));
    };

    const handleParameterChange = (index: number, field: keyof RuleParameter, value: string) => {
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

    const templateOptions = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);

    useEffect(() => {
        if (!selectedRule && templateOptions.length > 0 && templateId === 0) {
            setFormState((prev) => ({ ...prev, template_id: templateOptions[0].id }));
        }
    }, [templateOptions, selectedRule, templateId]);

    const handleDiff = async (version: RuleVersion) => {
        if (!selectedRule) {
            return;
        }
        const result = await diffRuleVersion(selectedRule.id, version.id, undefined);
        setDiffResult(result);
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px" }}>
            <section style={{ background: "white", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h2 style={{ margin: 0, fontSize: "18px" }}>Rules</h2>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedRule(null);
                            setFormState(defaultRule);
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
                {rulesQuery.isLoading && <p>Loading rules...</p>}
                {rulesQuery.error && <p>Error loading rules.</p>}
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {rulesQuery.data?.map((rule) => {
                        const isActive = selectedRule?.id === rule.id;
                        return (
                            <li
                                key={rule.id}
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
                                    onClick={() => handleSelect(rule)}
                                    style={{
                                        textAlign: "left",
                                        flex: 1,
                                        background: "none",
                                        border: "none",
                                        fontSize: "14px",
                                        color: "#0f172a"
                                    }}
                                >
                                    <strong>{rule.name}</strong>
                                    <div style={{ fontSize: "12px", color: "#64748b" }}>v{rule.version} • {rule.status}</div>
                                </button>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <button
                                        type="button"
                                        onClick={() => publishMutation.mutate(rule.id)}
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
                                            if (window.confirm("Delete this rule?")) {
                                                deleteMutation.mutate(rule.id);
                                            }
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
                    <h2 style={{ margin: 0, fontSize: "18px" }}>{selectedRule ? "Edit Rule" : "Create Rule"}</h2>
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
                            <span>Template</span>
                            <select
                                required
                                value={formState.template_id}
                                onChange={(event) => setFormState({ ...formState, template_id: Number(event.target.value) })}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            >
                                <option value={0} disabled>
                                    Select template
                                </option>
                                {templateOptions.map((template: Template) => (
                                    <option key={template.id} value={template.id}>
                                        {template.name}
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
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span>Custom rule</span>
                            <select
                                value={formState.is_custom ? "true" : "false"}
                                onChange={(event) =>
                                    setFormState({ ...formState, is_custom: event.target.value === "true" })
                                }
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5f5" }}
                            >
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        </label>
                    </div>
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
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr)) 32px",
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
                                placeholder="Value"
                                value={parameter.value}
                                onChange={(event) => handleParameterChange(index, "value", event.target.value)}
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
                        {selectedRule && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedRule(null);
                                    setFormState(defaultRule);
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
                            {selectedRule ? "Save changes" : "Create rule"}
                        </button>
                    </div>
                </form>
                {selectedRule && (
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
        </div>
    );
};

export default RulesPage;
