import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_auth_me_unauthenticated():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/auth/me")
        assert res.status_code == 200
        data = res.json()
        assert data["logged_in"] is False
        assert data["username"] is None

@pytest.mark.asyncio
async def test_auth_oauth_initiate():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/auth/oauth/initiate")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "oauth_token" in data
        assert "Special:OAuth/authorize" in data["authorize_url"]
        assert "4ed93435dc4f6ca892173251eed1c644" in data["authorize_url"]

@pytest.mark.asyncio
async def test_auth_login_invalid_credentials():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/auth/login", json={"username": "FakeNonExistentUser12345", "password": "WrongPassword"})
        # Should return 401 Unauthorized
        assert res.status_code == 401
