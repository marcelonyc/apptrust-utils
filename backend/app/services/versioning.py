from __future__ import annotations

from datetime import datetime
from difflib import unified_diff
from typing import Any, Iterable
from sqlmodel import Session, select
from ..models import (
    Rule,
    RuleStatus,
    RuleVersion,
    Template,
    TemplateStatus,
    TemplateVersion,
)


class VersioningService:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def _generate_version_ref(prefix: str, count: int) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"{prefix}-{count:03d}-{timestamp}"

    def _collect_template_data(self, template: Template) -> dict[str, Any]:
        return {
            "name": template.name,
            "description": template.description,
            "category": template.category,
            "data_source_type": template.data_source_type,
            "version": template.version,
            "rego": template.rego,
            "parameters": template.parameters,
            "scanners": template.scanners,
        }

    def _collect_rule_data(self, rule: Rule) -> dict[str, Any]:
        return {
            "name": rule.name,
            "description": rule.description,
            "is_custom": rule.is_custom,
            "template_id": rule.template_id,
            "version": rule.version,
            "parameters": rule.parameters,
        }

    def create_template_version(
        self, template: Template, message: str, author: str
    ) -> TemplateVersion:
        existing_versions = self.session.exec(
            select(TemplateVersion).where(
                TemplateVersion.template_id == template.id
            )
        ).all()
        version_ref = self._generate_version_ref(
            "tmpl", len(existing_versions) + 1
        )
        parent_id = existing_versions[-1].id if existing_versions else None
        version = TemplateVersion(
            template_id=template.id,
            version_ref=version_ref,
            message=message,
            author=author,
            data=self._collect_template_data(template),
            parent_id=parent_id,
        )
        self.session.add(version)
        self.session.flush()
        template.updated_at = datetime.utcnow()
        if template.status == TemplateStatus.published:
            template.status = TemplateStatus.draft
        return version

    def create_rule_version(
        self, rule: Rule, message: str, author: str
    ) -> RuleVersion:
        existing_versions = self.session.exec(
            select(RuleVersion).where(RuleVersion.rule_id == rule.id)
        ).all()
        version_ref = self._generate_version_ref(
            "rule", len(existing_versions) + 1
        )
        parent_id = existing_versions[-1].id if existing_versions else None
        version = RuleVersion(
            rule_id=rule.id,
            version_ref=version_ref,
            message=message,
            author=author,
            data=self._collect_rule_data(rule),
            parent_id=parent_id,
        )
        self.session.add(version)
        self.session.flush()
        rule.updated_at = datetime.utcnow()
        if rule.status == RuleStatus.published:
            rule.status = RuleStatus.draft
        return version

    def diff_versions(
        self, first: dict[str, Any], second: dict[str, Any]
    ) -> list[str]:
        def _pretty_lines(data: dict[str, Any]) -> Iterable[str]:
            for key in sorted(data.keys()):
                yield f"{key}: {data[key]}"

        return list(
            unified_diff(
                list(_pretty_lines(first)),
                list(_pretty_lines(second)),
                lineterm="",
            )
        )
