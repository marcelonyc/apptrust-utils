from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy.dialects.sqlite import JSON
from sqlmodel import Column, Field, Relationship, SQLModel


class TemplateStatus(str, Enum):
    draft = "draft"
    published = "published"


class RuleStatus(str, Enum):
    draft = "draft"
    published = "published"


class TemplateVersion(SQLModel, table=True):
    __tablename__ = "template_versions"

    id: Optional[int] = Field(default=None, primary_key=True)
    template_id: int = Field(foreign_key="templates.id", index=True)
    version_ref: str = Field(index=True)
    message: str = Field(default="")
    author: str = Field(default="system")
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    parent_id: Optional[int] = Field(
        default=None, foreign_key="template_versions.id"
    )
    is_published: bool = Field(default=False)

    template: "Template" = Relationship(
        back_populates="versions",
        sa_relationship_kwargs={
            "primaryjoin": "TemplateVersion.template_id==Template.id",
            "foreign_keys": "TemplateVersion.template_id",
        },
    )
    parent: Optional["TemplateVersion"] = Relationship(
        sa_relationship_kwargs={"remote_side": "TemplateVersion.id"}
    )


class Template(SQLModel, table=True):
    __tablename__ = "templates"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    category: str
    data_source_type: str
    version: str
    rego: str
    parameters: list[dict[str, Any]] = Field(sa_column=Column(JSON))
    scanners: list[str] = Field(sa_column=Column(JSON), default_factory=list)
    status: TemplateStatus = Field(default=TemplateStatus.draft)
    remote_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_published_version_id: Optional[int] = Field(
        default=None, foreign_key="template_versions.id"
    )

    versions: list[TemplateVersion] = Relationship(
        back_populates="template",
        sa_relationship_kwargs={
            "primaryjoin": "Template.id==TemplateVersion.template_id",
            "foreign_keys": "TemplateVersion.template_id",
        },
    )
    last_published_version: Optional[TemplateVersion] = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "Template.last_published_version_id==TemplateVersion.id",
            "foreign_keys": "Template.last_published_version_id",
            "viewonly": True,
        }
    )
    rules: list["Rule"] = Relationship(
        back_populates="template",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class RuleVersion(SQLModel, table=True):
    __tablename__ = "rule_versions"

    id: Optional[int] = Field(default=None, primary_key=True)
    rule_id: int = Field(foreign_key="rules.id", index=True)
    version_ref: str = Field(index=True)
    message: str = Field(default="")
    author: str = Field(default="system")
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    parent_id: Optional[int] = Field(
        default=None, foreign_key="rule_versions.id"
    )
    is_published: bool = Field(default=False)

    rule: "Rule" = Relationship(
        back_populates="versions",
        sa_relationship_kwargs={
            "primaryjoin": "RuleVersion.rule_id==Rule.id",
            "foreign_keys": "RuleVersion.rule_id",
        },
    )
    parent: Optional["RuleVersion"] = Relationship(
        sa_relationship_kwargs={"remote_side": "RuleVersion.id"}
    )


class Rule(SQLModel, table=True):
    __tablename__ = "rules"

    id: Optional[int] = Field(default=None, primary_key=True)
    template_id: int = Field(foreign_key="templates.id")
    name: str = Field(index=True)
    description: Optional[str] = None
    is_custom: bool = Field(default=True)
    parameters: list[dict[str, Any]] = Field(sa_column=Column(JSON))
    status: RuleStatus = Field(default=RuleStatus.draft)
    remote_id: Optional[str] = Field(default=None, index=True)
    version: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_published_version_id: Optional[int] = Field(
        default=None, foreign_key="rule_versions.id"
    )

    template: Template = Relationship(back_populates="rules")
    versions: list[RuleVersion] = Relationship(
        back_populates="rule",
        sa_relationship_kwargs={
            "primaryjoin": "Rule.id==RuleVersion.rule_id",
            "foreign_keys": "RuleVersion.rule_id",
        },
    )
    last_published_version: Optional[RuleVersion] = Relationship(
        sa_relationship_kwargs={
            "primaryjoin": "Rule.last_published_version_id==RuleVersion.id",
            "foreign_keys": "Rule.last_published_version_id",
            "viewonly": True,
        }
    )
