from __future__ import annotations

from fastapi import APIRouter, Depends
from ..schemas import (
    RegoEvaluationRequest,
    RegoEvaluationResponse,
    RegoValidationRequest,
    RegoValidationResponse,
)
from ..services.rego_validator import RegoValidator

router = APIRouter(prefix="/validation", tags=["validation"])


def get_validator() -> RegoValidator:
    return RegoValidator()


@router.post("/rego", response_model=RegoValidationResponse)
def validate_rego(
    payload: RegoValidationRequest,
    validator: RegoValidator = Depends(get_validator),
) -> RegoValidationResponse:
    valid, errors, warnings = validator.validate(payload.rego)
    return RegoValidationResponse(
        valid=valid, errors=errors or None, warnings=warnings or None
    )


@router.post("/rego/eval", response_model=RegoEvaluationResponse)
def evaluate_rego(
    payload: RegoEvaluationRequest,
    validator: RegoValidator = Depends(get_validator),
) -> RegoEvaluationResponse:
    result, errors, warnings, command = validator.evaluate(
        payload.rego, payload.input
    )
    return RegoEvaluationResponse(
        result=result,
        errors=errors or None,
        warnings=warnings or None,
        command=command or None,
    )
