from __future__ import annotations

from typing import Any, Optional
import requests
from requests import Response
from ..core.config import get_settings


class JFrogClientError(RuntimeError):
    def __init__(
        self, message: str, response: Optional[Response] = None
    ) -> None:
        super().__init__(message)
        self.response = response


class JFrogClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = str(self.settings.jfrog_base_url).rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {self.settings.jfrog_api_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> Response:
        url = f"{self.base_url}{path}"
        response = self.session.request(method, url, **kwargs, timeout=30)
        if response.status_code >= 400:
            raise JFrogClientError(
                f"JFrog API error {response.status_code}: {response.text}",
                response=response,
            )
        return response

    @staticmethod
    def _payload_from_response(response: Response) -> dict[str, Any]:
        if not response.content:
            return {}

        content_type = response.headers.get("Content-Type", "").lower()
        if "application/json" not in content_type:
            text = response.text.strip()
            return {"raw": text} if text else {}

        try:
            return response.json()
        except ValueError as exc:
            raise JFrogClientError(
                "Failed to parse JSON response from JFrog API",
                response=response,
            ) from exc

    # Templates
    def create_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = self._request(
            "POST", "/unifiedpolicy/api/v1/templates", json=payload
        )
        data = self._payload_from_response(response)
        if "id" not in data:
            location = response.headers.get("Location")
            if location:
                data["id"] = location.rstrip("/").rsplit("/", 1)[-1]
        data.setdefault("_status_code", response.status_code)
        return data

    def update_template(
        self, template_remote_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        response = self._request(
            "PUT",
            f"/unifiedpolicy/api/v1/templates/{template_remote_id}",
            json=payload,
        )
        data = self._payload_from_response(response)
        data.setdefault("id", template_remote_id)
        data.setdefault("_status_code", response.status_code)
        return data

    def get_template(self, template_remote_id: str) -> dict[str, Any]:
        response = self._request(
            "GET", f"/unifiedpolicy/api/v1/templates/{template_remote_id}"
        )
        data = self._payload_from_response(response)
        data.setdefault("id", template_remote_id)
        data.setdefault("_status_code", response.status_code)
        return data

    def delete_template(self, template_remote_id: str) -> None:
        self._request(
            "DELETE", f"/unifiedpolicy/api/v1/templates/{template_remote_id}"
        )

    # Rules
    def create_rule(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = self._request(
            "POST", "/unifiedpolicy/api/v1/rules", json=payload
        )
        data = self._payload_from_response(response)
        if "id" not in data:
            location = response.headers.get("Location")
            if location:
                data["id"] = location.rstrip("/").rsplit("/", 1)[-1]
        data.setdefault("_status_code", response.status_code)
        return data

    def update_rule(
        self, rule_remote_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        response = self._request(
            "PUT",
            f"/unifiedpolicy/api/v1/rules/{rule_remote_id}",
            json=payload,
        )
        data = self._payload_from_response(response)
        data.setdefault("id", rule_remote_id)
        data.setdefault("_status_code", response.status_code)
        return data

    def get_rule(self, rule_remote_id: str) -> dict[str, Any]:
        response = self._request(
            "GET", f"/unifiedpolicy/api/v1/rules/{rule_remote_id}"
        )
        data = self._payload_from_response(response)
        data.setdefault("id", rule_remote_id)
        data.setdefault("_status_code", response.status_code)
        return data

    def delete_rule(self, rule_remote_id: str) -> None:
        self._request(
            "DELETE", f"/unifiedpolicy/api/v1/rules/{rule_remote_id}"
        )
