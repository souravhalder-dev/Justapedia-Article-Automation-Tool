import os
import json
import secrets
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import httpx
from requests_oauthlib import OAuth1Session
from urllib.parse import parse_qs
import jwt

from ..config import settings
from ..database import AsyncSessionLocal
from ..models import UserSession
from sqlalchemy import select, delete

logger = logging.getLogger(__name__)

# Temporary in-memory stores for fast access and OAuth request tokens
_pending_oauth_tokens: Dict[str, Dict[str, Any]] = {}
_active_sessions_cache: Dict[str, Dict[str, Any]] = {}

class AuthService:
    """
    Manages multi-user authentication for Justapedia.
    Supports:
    1. MediaWiki OAuth 1.0a (via registered consumer key & secret)
    2. Direct Justapedia User/Bot Login (via MediaWiki Action API login tokens)
    """

    def __init__(self):
        self.api_url = settings.JUSTAPEDIA_API_URL
        self.consumer_key = settings.OAUTH_CONSUMER_KEY
        self.consumer_secret = settings.OAUTH_CONSUMER_SECRET
        self.headers = {
            "User-Agent": settings.USER_AGENT,
            "Accept": "application/json, text/plain, */*",
        }

    # --------------------------------------------------------------------------
    # OAuth 1.0a Flow
    # --------------------------------------------------------------------------
    def initiate_oauth(self) -> Dict[str, Any]:
        """
        Step 1: Obtain a request token from Justapedia Special:OAuth/initiate.
        """
        if not self.consumer_key or not self.consumer_secret:
            raise ValueError("OAuth consumer credentials not configured on server.")

        oauth = OAuth1Session(
            client_key=self.consumer_key,
            client_secret=self.consumer_secret,
            callback_uri="oob"
        )
        headers = {"User-Agent": settings.USER_AGENT}
        resp = oauth.post("https://justapedia.org/Special:OAuth/initiate", headers=headers, timeout=15)
        
        if resp.status_code != 200:
            raise ValueError(f"Failed to initiate OAuth with Justapedia: {resp.text}")

        params = parse_qs(resp.text)
        oauth_token = params.get("oauth_token", [""])[0]
        oauth_token_secret = params.get("oauth_token_secret", [""])[0]

        if not oauth_token or not oauth_token_secret:
            raise ValueError(f"Unexpected response from OAuth initiate: {resp.text}")

        # Cache request token secret for Step 2
        _pending_oauth_tokens[oauth_token] = {
            "oauth_token_secret": oauth_token_secret,
            "created_at": datetime.utcnow()
        }

        authorize_url = (
            f"https://justapedia.org/Special:OAuth/authorize"
            f"?oauth_token={oauth_token}&oauth_consumer_key={self.consumer_key}"
        )

        return {
            "success": True,
            "oauth_token": oauth_token,
            "authorize_url": authorize_url
        }

    async def complete_oauth(self, oauth_token: str, oauth_verifier: str) -> Dict[str, Any]:
        """
        Step 2: Exchange authorized request token + verifier for user access token.
        Then identify user and establish session.
        """
        pending = _pending_oauth_tokens.pop(oauth_token, None)
        token_secret = pending.get("oauth_token_secret") if pending else None

        oauth = OAuth1Session(
            client_key=self.consumer_key,
            client_secret=self.consumer_secret,
            resource_owner_key=oauth_token,
            resource_owner_secret=token_secret,
            verifier=oauth_verifier.strip()
        )
        headers = {"User-Agent": settings.USER_AGENT}
        resp = oauth.post("https://justapedia.org/Special:OAuth/token", headers=headers, timeout=15)
        
        if resp.status_code != 200:
            raise ValueError(f"OAuth token exchange failed: {resp.text}")

        params = parse_qs(resp.text)
        access_token = params.get("oauth_token", [""])[0]
        access_token_secret = params.get("oauth_token_secret", [""])[0]

        if not access_token or not access_token_secret:
            raise ValueError(f"Invalid access token response: {resp.text}")

        # Step 3: Identify user
        ident_oauth = OAuth1Session(
            client_key=self.consumer_key,
            client_secret=self.consumer_secret,
            resource_owner_key=access_token,
            resource_owner_secret=access_token_secret
        )
        ident_resp = ident_oauth.get("https://justapedia.org/Special:OAuth/identify", headers=headers, timeout=15)
        
        username = "Justapedia Editor"
        if ident_resp.status_code == 200 and ident_resp.text:
            try:
                # MediaWiki identify returns a signed JWT
                claims = jwt.decode(ident_resp.text, options={"verify_signature": False})
                username = claims.get("username", username)
            except Exception as e:
                logger.warning(f"Could not decode identify JWT: {e}")

        session_token = secrets.token_hex(32)
        session_data = {
            "oauth_token": access_token,
            "oauth_token_secret": access_token_secret
        }

        await self._persist_session(session_token, username, "oauth", session_data)

        return {
            "success": True,
            "session_token": session_token,
            "username": username,
            "auth_type": "oauth"
        }

    # --------------------------------------------------------------------------
    # Direct MediaWiki Credentials Flow (Username + Password / Bot Password)
    # --------------------------------------------------------------------------
    async def login_credentials(self, username: str, password: str) -> Dict[str, Any]:
        """
        Authenticate any user directly with Justapedia using Action API login token.
        """
        uname = (username or "").strip()
        passwd = (password or "").strip()

        if not uname or not passwd:
            return {"success": False, "message": "Please provide both username and password."}

        async with httpx.AsyncClient(headers=self.headers, timeout=20.0, follow_redirects=True) as client:
            # 1. Fetch login token
            token_res = await client.get(self.api_url, params={
                "action": "query",
                "meta": "tokens",
                "type": "login",
                "format": "json"
            })
            token_res.raise_for_status()
            login_token = token_res.json().get("query", {}).get("tokens", {}).get("logintoken")

            if not login_token:
                return {"success": False, "message": "Could not retrieve login token from Justapedia."}

            # 2. Submit login
            login_res = await client.post(self.api_url, data={
                "action": "login",
                "lgname": uname,
                "lgpassword": passwd,
                "lgtoken": login_token,
                "format": "json"
            })
            login_res.raise_for_status()
            res_data = login_res.json()
            result = res_data.get("login", {}).get("result")

            if result != "Success":
                reason = res_data.get("login", {}).get("reason", result)
                if result == "WrongPass":
                    reason = "Incorrect password or bot password."
                elif result == "NotExists":
                    reason = f"User account '{uname}' does not exist on Justapedia."
                return {"success": False, "message": f"Login failed: {reason}"}

            verified_username = res_data.get("login", {}).get("lgusername", uname)

            # Extract session cookies
            cookie_dict = {}
            for name, val in client.cookies.items():
                cookie_dict[name] = val

            session_token = secrets.token_hex(32)
            session_data = {"cookies": cookie_dict}

            await self._persist_session(session_token, verified_username, "credentials", session_data)

            return {
                "success": True,
                "session_token": session_token,
                "username": verified_username,
                "auth_type": "credentials"
            }

    # --------------------------------------------------------------------------
    # Session Persistence & Validation
    # --------------------------------------------------------------------------
    async def _persist_session(
        self,
        session_token: str,
        username: str,
        auth_type: str,
        session_data: Dict[str, Any]
    ):
        """Persist user session in database and in-memory cache."""
        expires_at = datetime.utcnow() + timedelta(days=7)
        data_json = json.dumps(session_data)

        _active_sessions_cache[session_token] = {
            "session_token": session_token,
            "username": username,
            "auth_type": auth_type,
            "session_data": session_data,
            "expires_at": expires_at
        }

        try:
            async with AsyncSessionLocal() as db:
                session_obj = UserSession(
                    session_token=session_token,
                    username=username,
                    auth_type=auth_type,
                    session_data=data_json,
                    expires_at=expires_at
                )
                db.add(session_obj)
                await db.commit()
        except Exception as e:
            logger.warning(f"Could not persist session to database: {e}")

    async def get_session(self, session_token: Optional[str]) -> Optional[Dict[str, Any]]:
        """Retrieve active user session if valid and not expired."""
        if not session_token:
            return None

        # Check memory cache first
        if session_token in _active_sessions_cache:
            sess = _active_sessions_cache[session_token]
            if sess.get("expires_at") and sess["expires_at"] > datetime.utcnow():
                return sess

        # Fallback to database
        try:
            async with AsyncSessionLocal() as db:
                stmt = select(UserSession).where(UserSession.session_token == session_token)
                res = await db.execute(stmt)
                user_sess = res.scalar_one_or_none()
                if user_sess:
                    if user_sess.expires_at and user_sess.expires_at < datetime.utcnow():
                        return None
                    sess_data = json.loads(user_sess.session_data or "{}")
                    sess_dict = {
                        "session_token": user_sess.session_token,
                        "username": user_sess.username,
                        "auth_type": user_sess.auth_type,
                        "session_data": sess_data,
                        "expires_at": user_sess.expires_at
                    }
                    _active_sessions_cache[session_token] = sess_dict
                    return sess_dict
        except Exception as e:
            logger.warning(f"Database error reading session: {e}")

        return None

    async def logout(self, session_token: Optional[str]):
        """Terminate user session."""
        if not session_token:
            return

        _active_sessions_cache.pop(session_token, None)
        try:
            async with AsyncSessionLocal() as db:
                stmt = delete(UserSession).where(UserSession.session_token == session_token)
                await db.execute(stmt)
                await db.commit()
        except Exception as e:
            logger.warning(f"Database error deleting session: {e}")

auth_service = AuthService()
