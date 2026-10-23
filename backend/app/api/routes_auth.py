from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from ..services.auth_service import auth_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class CredentialsLoginRequest(BaseModel):
    username: str
    password: str

class OAuthInitiateResponse(BaseModel):
    success: bool
    oauth_token: str
    authorize_url: str

class OAuthCallbackRequest(BaseModel):
    oauth_token: str
    oauth_verifier: str

class AuthMeResponse(BaseModel):
    logged_in: bool
    username: Optional[str] = None
    auth_type: Optional[str] = None

@router.get("/me", response_model=AuthMeResponse)
async def get_current_user(authorization: Optional[str] = Header(None)):
    """Check current user authentication state."""
    session_token = None
    if authorization and authorization.startswith("Bearer "):
        session_token = authorization.split("Bearer ", 1)[1].strip()

    session = await auth_service.get_session(session_token)
    if not session:
        return AuthMeResponse(logged_in=False, username=None, auth_type=None)

    return AuthMeResponse(
        logged_in=True,
        username=session.get("username"),
        auth_type=session.get("auth_type")
    )

@router.post("/login")
async def login_with_credentials(req: CredentialsLoginRequest):
    """Log in any Justapedia user directly using their account or bot password."""
    res = await auth_service.login_credentials(req.username, req.password)
    if not res.get("success"):
        raise HTTPException(status_code=401, detail=res.get("message", "Login failed"))
    return res

@router.post("/oauth/initiate", response_model=OAuthInitiateResponse)
async def initiate_oauth():
    """Start OAuth 1.0a flow with Justapedia."""
    try:
        res = auth_service.initiate_oauth()
        return OAuthInitiateResponse(**res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate OAuth: {str(e)}")

@router.post("/oauth/callback")
async def complete_oauth(req: OAuthCallbackRequest):
    """Complete OAuth 1.0a flow with verifier code from Justapedia."""
    try:
        res = await auth_service.complete_oauth(req.oauth_token, req.oauth_verifier)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth verification failed: {str(e)}")

@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Log out current user."""
    session_token = None
    if authorization and authorization.startswith("Bearer "):
        session_token = authorization.split("Bearer ", 1)[1].strip()

    await auth_service.logout(session_token)
    return {"success": True, "message": "Logged out successfully"}
