"""Tests for app/api/routes/utils.py health check endpoint."""

from fastapi.testclient import TestClient


def test_health_check(client: TestClient) -> None:
    """Test health check endpoint returns True."""
    response = client.get("/api/v1/utils/health-check/")
    
    assert response.status_code == 200
    assert response.json() is True
