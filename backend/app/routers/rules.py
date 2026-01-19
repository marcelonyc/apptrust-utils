from __future__ import annotations

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from ..database import get_session
from ..models import Rule, RuleStatus, RuleVersion, Template
from ..schemas import (
    PublishResult,
    RuleCreate,
    RuleRead,
    RuleUpdate,
    RuleVersionRead,
    TemplateDiff,
)
from ..services.jfrog import JFrogClient, JFrogClientError
from ..services.versioning import VersioningService

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("/", response_model=list[RuleRead])
def list_rules(session: Session = Depends(get_session)) -> list[RuleRead]:
    results = session.exec(select(Rule).order_by(Rule.created_at.desc())).all()
    return [RuleRead.model_validate(r, from_attributes=True) for r in results]


@router.post("/", response_model=RuleRead, status_code=status.HTTP_201_CREATED)
def create_rule(
    payload: RuleCreate, session: Session = Depends(get_session)
) -> RuleRead:
    template = session.get(Template, payload.template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Associated template not found",
        )

    rule = Rule(
        template_id=payload.template_id,
        name=payload.name,
        description=payload.description,
        is_custom=payload.is_custom,
        parameters=[param.model_dump() for param in payload.parameters],
        status=RuleStatus.draft,
        version=payload.version,
    )
    session.add(rule)
    session.flush()

    versioning = VersioningService(session)
    versioning.create_rule_version(
        rule, payload.commit_message, payload.author
    )

    session.commit()
    session.refresh(rule)
    return RuleRead.model_validate(rule, from_attributes=True)


@router.get("/{rule_id}", response_model=RuleRead)
def get_rule(
    rule_id: int, session: Session = Depends(get_session)
) -> RuleRead:
    rule = session.get(Rule, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )
    return RuleRead.model_validate(rule, from_attributes=True)


@router.put("/{rule_id}", response_model=RuleRead)
def update_rule(
    rule_id: int, payload: RuleUpdate, session: Session = Depends(get_session)
) -> RuleRead:
    rule = session.get(Rule, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    template = session.get(Template, payload.template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Associated template not found",
        )

    rule.template_id = payload.template_id
    rule.name = payload.name
    rule.description = payload.description
    rule.is_custom = payload.is_custom
    rule.parameters = [param.model_dump() for param in payload.parameters]
    rule.version = payload.version

    versioning = VersioningService(session)
    versioning.create_rule_version(
        rule, payload.commit_message, payload.author
    )

    session.commit()
    session.refresh(rule)
    return RuleRead.model_validate(rule, from_attributes=True)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: int, session: Session = Depends(get_session)) -> None:
    rule = session.get(Rule, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )
    session.delete(rule)
    session.commit()


@router.get("/{rule_id}/versions", response_model=list[RuleVersionRead])
def list_rule_versions(
    rule_id: int, session: Session = Depends(get_session)
) -> list[RuleVersionRead]:
    rule = session.get(Rule, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )
    versions = session.exec(
        select(RuleVersion)
        .where(RuleVersion.rule_id == rule_id)
        .order_by(RuleVersion.created_at.desc())
    ).all()
    return [
        RuleVersionRead.model_validate(v, from_attributes=True)
        for v in versions
    ]


@router.get(
    "/{rule_id}/versions/{version_id}/diff", response_model=TemplateDiff
)
def diff_rule_version(
    rule_id: int,
    version_id: int,
    compare_to: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
) -> TemplateDiff:
    rule = session.get(Rule, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    version = session.get(RuleVersion, version_id)
    if not version or version.rule_id != rule_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule version not found",
        )

    base_version = version
    if compare_to:
        candidate = session.get(RuleVersion, compare_to)
        if not candidate or candidate.rule_id != rule_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid comparison version",
            )
        base_version = candidate
    elif version.parent_id:
        parent = session.get(RuleVersion, version.parent_id)
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent version missing",
            )
        base_version = parent

    versioning = VersioningService(session)
    diff_lines = versioning.diff_versions(base_version.data, version.data)
    return TemplateDiff(
        version_a=base_version.version_ref,
        version_b=version.version_ref,
        diff=diff_lines,
    )


@router.post("/{rule_id}/publish", response_model=PublishResult)
def publish_rule(
    rule_id: int, session: Session = Depends(get_session)
) -> PublishResult:
    rule = session.get(Rule, rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found"
        )

    template = session.get(Template, rule.template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Associated template not found",
        )
    if not template.remote_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template must be published before publishing rules",
        )

    latest_version = session.exec(
        select(RuleVersion)
        .where(RuleVersion.rule_id == rule_id)
        .order_by(RuleVersion.created_at.desc())
    ).first()
    if not latest_version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No versions available to publish",
        )

    payload = latest_version.data.copy()
    payload["template_id"] = template.remote_id

    client = JFrogClient()
    try:
        if rule.remote_id:
            response = client.update_rule(rule.remote_id, payload)
        else:
            response = client.create_rule(payload)
    except JFrogClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    remote_id = response.get("id") or rule.remote_id
    if not remote_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Missing rule id from JFrog response",
        )

    rule.remote_id = remote_id
    rule.status = RuleStatus.published
    rule.last_published_version_id = latest_version.id
    rule.updated_at = datetime.utcnow()
    latest_version.is_published = True

    session.add(rule)
    session.add(latest_version)
    session.commit()
    session.refresh(rule)

    return PublishResult(
        remote_id=remote_id,
        version_ref=latest_version.version_ref,
        published_at=rule.updated_at,
    )
