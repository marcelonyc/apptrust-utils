from __future__ import annotations

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from ..database import get_session
from ..models import Template, TemplateStatus, TemplateVersion
from ..schemas import (
    PublishResult,
    TemplateCreate,
    TemplateDiff,
    TemplateRead,
    TemplateUpdate,
    TemplateVersionRead,
)
from ..services.jfrog import JFrogClient, JFrogClientError
from ..services.versioning import VersioningService

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=list[TemplateRead])
def list_templates(
    session: Session = Depends(get_session),
) -> list[TemplateRead]:
    results = session.exec(
        select(Template).order_by(Template.created_at.desc())
    ).all()
    return [
        TemplateRead.model_validate(t, from_attributes=True) for t in results
    ]


@router.post(
    "/", response_model=TemplateRead, status_code=status.HTTP_201_CREATED
)
def create_template(
    payload: TemplateCreate, session: Session = Depends(get_session)
) -> TemplateRead:
    template = Template(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        data_source_type=payload.data_source_type,
        version=payload.version,
        rego=payload.rego,
        parameters=[param.model_dump() for param in payload.parameters],
        scanners=payload.scanners,
        status=TemplateStatus.draft,
    )
    session.add(template)
    session.flush()

    versioning = VersioningService(session)
    versioning.create_template_version(
        template, payload.commit_message, payload.author
    )
    session.commit()
    session.refresh(template)
    return TemplateRead.model_validate(template, from_attributes=True)


@router.get("/{template_id}", response_model=TemplateRead)
def get_template(
    template_id: int, session: Session = Depends(get_session)
) -> TemplateRead:
    template = session.get(Template, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )
    return TemplateRead.model_validate(template, from_attributes=True)


@router.put("/{template_id}", response_model=TemplateRead)
def update_template(
    template_id: int,
    payload: TemplateUpdate,
    session: Session = Depends(get_session),
) -> TemplateRead:
    template = session.get(Template, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    template.name = payload.name
    template.description = payload.description
    template.category = payload.category
    template.data_source_type = payload.data_source_type
    template.version = payload.version
    template.rego = payload.rego
    template.parameters = [param.model_dump() for param in payload.parameters]
    template.scanners = payload.scanners

    versioning = VersioningService(session)
    versioning.create_template_version(
        template, payload.commit_message, payload.author
    )

    session.commit()
    session.refresh(template)
    return TemplateRead.model_validate(template, from_attributes=True)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int, session: Session = Depends(get_session)
) -> None:
    template = session.get(Template, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )
    session.delete(template)
    session.commit()


@router.get(
    "/{template_id}/versions", response_model=list[TemplateVersionRead]
)
def list_template_versions(
    template_id: int, session: Session = Depends(get_session)
) -> list[TemplateVersionRead]:
    template = session.get(Template, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )
    versions = session.exec(
        select(TemplateVersion)
        .where(TemplateVersion.template_id == template_id)
        .order_by(TemplateVersion.created_at.desc())
    ).all()
    return [
        TemplateVersionRead.model_validate(v, from_attributes=True)
        for v in versions
    ]


@router.get(
    "/{template_id}/versions/{version_id}/diff", response_model=TemplateDiff
)
def diff_template_version(
    template_id: int,
    version_id: int,
    compare_to: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
) -> TemplateDiff:
    template = session.get(Template, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    version = session.get(TemplateVersion, version_id)
    if not version or version.template_id != template_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template version not found",
        )

    base_version: TemplateVersion
    if compare_to:
        base_version = session.get(TemplateVersion, compare_to)
        if not base_version or base_version.template_id != template_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid comparison version",
            )
    elif version.parent_id:
        base_version = session.get(TemplateVersion, version.parent_id)
        if base_version is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent version missing",
            )
    else:
        base_version = version

    versioning = VersioningService(session)
    diff_lines = versioning.diff_versions(base_version.data, version.data)
    return TemplateDiff(
        version_a=base_version.version_ref,
        version_b=version.version_ref,
        diff=diff_lines,
    )


@router.post("/{template_id}/publish", response_model=PublishResult)
def publish_template(
    template_id: int, session: Session = Depends(get_session)
) -> PublishResult:
    template = session.get(Template, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    latest_version = session.exec(
        select(TemplateVersion)
        .where(TemplateVersion.template_id == template_id)
        .order_by(TemplateVersion.created_at.desc())
    ).first()
    if not latest_version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No versions available to publish",
        )

    payload = latest_version.data.copy()

    client = JFrogClient()
    try:
        if template.remote_id:
            response = client.update_template(template.remote_id, payload)
        else:
            response = client.create_template(payload)
    except JFrogClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    remote_id = response.get("id") or template.remote_id
    if not remote_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Missing template id from JFrog response",
        )

    template.remote_id = remote_id
    template.status = TemplateStatus.published
    template.last_published_version_id = latest_version.id
    template.updated_at = datetime.utcnow()
    latest_version.is_published = True

    session.add(template)
    session.add(latest_version)
    session.commit()
    session.refresh(template)

    return PublishResult(
        remote_id=remote_id,
        version_ref=latest_version.version_ref,
        published_at=template.updated_at,
    )
