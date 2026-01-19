from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field
from .models import RuleStatus, TemplateStatus


class TemplateParameter(BaseModel):
    name: str
    type: str
    description: Optional[str] = None


class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    data_source_type: str
    version: str
    rego: str
    parameters: list[TemplateParameter]
    scanners: list[str] = Field(default_factory=list)


class TemplateCreate(TemplateBase):
    commit_message: str = Field(default="Initial draft")
    author: str = Field(default="system")


class TemplateUpdate(TemplateBase):
    commit_message: str = Field(default="Update draft")
    author: str = Field(default="system")


class TemplateRead(TemplateBase):
    id: int
    status: TemplateStatus
    remote_id: Optional[str]
    created_at: datetime
    updated_at: datetime


class TemplateVersionRead(BaseModel):
    id: int
    template_id: int
    version_ref: str
    message: str
    author: str
    data: dict[str, Any]
    created_at: datetime
    parent_id: Optional[int]
    is_published: bool


class TemplateDiff(BaseModel):
    version_a: str
    version_b: str
    diff: list[str]


class RuleParameter(BaseModel):
    name: str
    value: str


class RuleBase(BaseModel):
    template_id: int
    name: str
    description: Optional[str] = None
    is_custom: bool = True
    version: str
    parameters: list[RuleParameter]


class RuleCreate(RuleBase):
    commit_message: str = Field(default="Initial draft")
    author: str = Field(default="system")


class RuleUpdate(RuleBase):
    commit_message: str = Field(default="Update draft")
    author: str = Field(default="system")


class RuleRead(RuleBase):
    id: int
    status: RuleStatus
    remote_id: Optional[str]
    created_at: datetime
    updated_at: datetime


class RuleVersionRead(BaseModel):
    id: int
    rule_id: int
    version_ref: str
    message: str
    author: str
    data: dict[str, Any]
    created_at: datetime
    parent_id: Optional[int]
    is_published: bool


class PublishResult(BaseModel):
    remote_id: str
    version_ref: str
    published_at: datetime


class RegoValidationRequest(BaseModel):
    rego: str


class RegoValidationResponse(BaseModel):
    valid: bool
    errors: Optional[list[str]] = None
    warnings: Optional[list[str]] = None


class RegoEvaluationRequest(BaseModel):
    rego: str
    input: dict[str, Any]


class RegoEvaluationResponse(BaseModel):
    result: Optional[Any]
    errors: Optional[list[str]] = None
    warnings: Optional[list[str]] = None
    command: Optional[str] = None
