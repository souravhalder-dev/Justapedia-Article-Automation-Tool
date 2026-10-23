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

@pytest.mark.asyncio
async def test_stateless_jwt_session_token():
    from app.services.auth_service import auth_service
    import jwt
    from app.config import settings
    from datetime import datetime, timedelta, timezone

    # Simulate issuing a JWT session for user "Sourav"
    exp_dt = datetime.now(timezone.utc) + timedelta(days=7)
    token = jwt.encode({
        "sub": "Sourav",
        "auth_type": "credentials",
        "session_data": {"cookies": {"session_id": "test_cookie_123"}},
        "exp": int(exp_dt.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp())
    }, settings.JWT_SECRET, algorithm="HS256")

    # get_session must decode and restore user identity and cookies statelessly
    session = await auth_service.get_session(token)
    assert session is not None
    assert session["username"] == "Sourav"
    assert session["auth_type"] == "credentials"
    assert session["session_data"]["cookies"]["session_id"] == "test_cookie_123"

@pytest.mark.asyncio
async def test_save_article_rejects_unauthenticated():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Saving without an authenticated user token must return 401
        res = await ac.post("/api/articles/1/save", json={
            "wikitext": "New text",
            "edit_summary": "Test update"
        })
        assert res.status_code == 401
        assert "Authentication required" in res.json().get("detail", "")
