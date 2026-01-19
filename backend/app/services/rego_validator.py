from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
from ..core.config import get_settings


class RegoValidator:
    def __init__(self) -> None:
        settings = get_settings()
        self.opa_path: Optional[str] = (
            settings.opa_binary_path or shutil.which("opa")
        )

    def validate(self, rego: str) -> tuple[bool, list[str], list[str]]:
        errors: list[str] = []
        warnings: list[str] = []

        if not rego.strip():
            errors.append("Rego content is empty.")
            return False, errors, warnings

        if not self.opa_path:
            warnings.append(
                "OPA binary not configured; performed only basic validation."
            )
            if "package" not in rego:
                errors.append(
                    "Rego policy must contain a package declaration."
                )
            return (len(errors) == 0), errors, warnings

        with tempfile.TemporaryDirectory() as temp_dir:
            rego_path = Path(temp_dir) / "policy.rego"
            rego_path.write_text(rego, encoding="utf-8")
            process = subprocess.run(
                [self.opa_path, "fmt", str(rego_path)],
                capture_output=True,
                text=True,
                check=False,
            )
            if process.returncode != 0:
                errors.append(
                    process.stderr.strip()
                    or "OPA returned non-zero exit status during validation."
                )
                return False, errors, warnings

        return True, errors, warnings

    def evaluate(
        self, rego: str, input_data: dict
    ) -> tuple[Optional[dict], list[str], list[str], str]:
        """Evaluate rego against provided input using opa eval.
        
        Returns (result, errors, warnings, command).
        """
        errors: list[str] = []
        warnings: list[str] = []

        if not rego.strip():
            errors.append("Rego content is empty.")
            return None, errors, warnings, ""

        if not self.opa_path:
            warnings.append(
                "OPA binary not configured; evaluation is unavailable."
            )
            return None, errors, warnings, ""

        with tempfile.TemporaryDirectory() as temp_dir:
            rego_path = Path(temp_dir) / "policy.rego"
            input_path = Path(temp_dir) / "input.json"
            rego_path.write_text(rego, encoding="utf-8")
            input_path.write_text(json.dumps(input_data), encoding="utf-8")

            cmd = [
                self.opa_path,
                "eval",
                "-f",
                "json",
                "-i",
                str(input_path),
                "-d",
                str(rego_path),
                "data.curation.policies.allow",
            ]
            cmd_str = " ".join(cmd)

            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
            )

            if process.returncode != 0:
                stderr = process.stderr.strip() or "OPA evaluation failed."
                errors.append(stderr)
                return None, errors, warnings, cmd_str

            stdout = process.stdout.strip()
            if not stdout:
                warnings.append("OPA returned an empty result set.")
                return None, errors, warnings, cmd_str

            try:
                parsed = json.loads(stdout)
            except json.JSONDecodeError:
                errors.append("Failed to parse OPA output.")
                return None, errors, warnings, cmd_str

        return parsed, errors, warnings, cmd_str
