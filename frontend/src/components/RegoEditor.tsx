import { CSSProperties, useState } from "react";
import Editor from "@monaco-editor/react";
import { validateRego } from "../api/validation";

type Props = {
    value: string;
    onChange: (value: string) => void;
};

const baseStyle: CSSProperties = {
    marginTop: "8px",
    fontSize: "13px"
};

const successStyle: CSSProperties = { color: "#15803d" };
const errorStyle: CSSProperties = { color: "#b91c1c" };
const warningStyle: CSSProperties = { color: "#b45309" };

const RegoEditor = ({ value, onChange }: Props) => {
    const [feedback, setFeedback] = useState<string>("");
    const [feedbackStyle, setFeedbackStyle] = useState<CSSProperties>(baseStyle);
    const [busy, setBusy] = useState(false);

    const handleValidate = async () => {
        setBusy(true);
        setFeedback("Validating...");
        setFeedbackStyle(baseStyle);
        try {
            const result = await validateRego(value);
            if (result.valid) {
                const warningText = result.warnings?.join(" \u2022 ");
                setFeedback(warningText ?? "Rego validated successfully.");
                setFeedbackStyle({ ...baseStyle, ...(warningText ? warningStyle : successStyle) });
            } else {
                setFeedback(result.errors?.join(" \u2022 ") ?? "Validation failed.");
                setFeedbackStyle({ ...baseStyle, ...errorStyle });
            }
        } catch (error) {
            setFeedback("Validation request failed. Check server logs.");
            setFeedbackStyle({ ...baseStyle, ...errorStyle });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <div style={{ height: "320px", border: "1px solid #d1d5db", borderRadius: "6px", overflow: "hidden" }}>
                <Editor
                    height="100%"
                    defaultLanguage="rego"
                    theme="vs-dark"
                    value={value}
                    onChange={(next) => onChange(next ?? "")}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: "on"
                    }}
                />
            </div>
            <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                    type="button"
                    onClick={handleValidate}
                    disabled={busy}
                    style={{
                        backgroundColor: "#0ea5e9",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 12px",
                        fontSize: "13px"
                    }}
                >
                    {busy ? "Validating..." : "Validate Rego"}
                </button>
                {feedback && <span style={feedbackStyle}>{feedback}</span>}
            </div>
        </div>
    );
};

export default RegoEditor;
