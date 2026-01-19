import { CSSProperties } from "react";

type Props = {
    result: unknown;
    command: string;
    warnings?: string[];
    onClose: () => void;
};

const EvalResultModal = ({ result, command, warnings, onClose }: Props) => {
    const overlayStyle: CSSProperties = {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
    };

    const modalStyle: CSSProperties = {
        background: "white",
        borderRadius: "8px",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
        maxWidth: "600px",
        width: "90%",
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column"
    };

    const headerStyle: CSSProperties = {
        padding: "16px",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
    };

    const contentStyle: CSSProperties = {
        flex: 1,
        overflow: "auto",
        padding: "16px",
        fontFamily: "monospace",
        fontSize: "12px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        backgroundColor: "#f9fafb"
    };

    const footerStyle: CSSProperties = {
        borderTop: "1px solid #e5e7eb",
        padding: "12px 16px",
        fontSize: "11px",
        color: "#64748b",
        maxHeight: "80px",
        overflow: "auto",
        backgroundColor: "#f3f4f6"
    };

    const resultText = JSON.stringify(result, null, 2);
    const warningText = warnings?.length ? `Warnings: ${warnings.join(" • ")}\n\n` : "";

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h2 style={{ margin: 0, fontSize: "16px" }}>OPA Evaluation Result</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            fontSize: "20px",
                            cursor: "pointer",
                            color: "#64748b"
                        }}
                    >
                        ×
                    </button>
                </div>
                <div style={contentStyle}>
                    {warningText && <span style={{ color: "#b45309" }}>{warningText}</span>}
                    {resultText}
                </div>
                <div style={footerStyle}>
                    <strong>OPA Command:</strong>
                    <div style={{ marginTop: "4px", fontFamily: "monospace" }}>{command}</div>
                </div>
            </div>
        </div>
    );
};

export default EvalResultModal;
