import logging
import httpx
from typing import Dict, Any, Optional, List, Tuple
from ..config import settings

logger = logging.getLogger(__name__)

class JustapediaClient:
    """
    Robust MediaWiki API client for Justapedia Wiki.
    Handles authentication, CSRF tokens, session persistence,
    revision tracking, and edit conflict detection.
    """

    def __init__(self, api_url: Optional[str] = None):
        self.api_url = (api_url or settings.JUSTAPEDIA_API_URL).strip()
        self.headers = {
            "User-Agent": settings.USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
        }
        self.client = httpx.AsyncClient(
            headers=self.headers,
            timeout=30.0,
            follow_redirects=True,
            verify=True
        )
        self.logged_in_user: Optional[str] = None
        self._csrf_token: Optional[str] = None

    async def close(self):
        await self.client.aclose()

    async def test_connection(self) -> Dict[str, Any]:
        """Test API reachability, siteinfo, and user authentication state."""
        try:
            # Auto-authenticate as bot if credentials exist and not yet logged in
            if not self.logged_in_user and (settings.JUSTAPEDIA_BOT_USERNAME and settings.JUSTAPEDIA_BOT_PASSWORD):
                try:
                    await self.login()
                except Exception as log_err:
                    logger.warning(f"Auto-login during test_connection: {log_err}")

            params = {
                "action": "query",
                "meta": "siteinfo|userinfo",
                "siprop": "general",
                "uiprop": "rights|groups",
                "format": "json"
            }
            resp = await self.client.get(self.api_url, params=params)
            resp.raise_for_status()
            data = resp.json()
            
            general = data.get("query", {}).get("general", {})
            userinfo = data.get("query", {}).get("userinfo", {})
            
            user_name = userinfo.get("name")
            is_anon = "anon" in userinfo
            
            if not is_anon and user_name:
                self.logged_in_user = user_name

            return {
                "connected": True,
                "sitename": general.get("sitename", "Justapedia"),
                "generator": general.get("generator", "MediaWiki"),
                "logged_in": not is_anon,
                "username": user_name if not is_anon else None,
                "can_write": "writeapi" in general,
                "message": f"Successfully connected to {general.get('sitename')} ({general.get('generator')})"
            }
        except Exception as e:
            logger.error(f"Failed to connect to Justapedia: {e}")
            return {
                "connected": False,
                "sitename": None,
                "generator": None,
                "logged_in": False,
                "username": None,
                "can_write": False,
                "message": f"Connection error: {str(e)}"
            }

    async def login(self, username: Optional[str] = None, password: Optional[str] = None) -> Tuple[bool, str]:
        """
        Authenticate with Justapedia using MediaWiki login token flow.
        Works with both Bot Passwords and regular user accounts.
        """
        uname = (username or settings.JUSTAPEDIA_BOT_USERNAME or "").strip()
        passwd = (password or settings.JUSTAPEDIA_BOT_PASSWORD or "").strip()
        
        if not uname or not passwd:
            return False, "No username or password provided."

        try:
            # Step 1: Obtain login token
            token_params = {
                "action": "query",
                "meta": "tokens",
                "type": "login",
                "format": "json"
            }
            resp = await self.client.get(self.api_url, params=token_params)
            resp.raise_for_status()
            token_data = resp.json()
            login_token = token_data.get("query", {}).get("tokens", {}).get("logintoken")
            
            if not login_token:
                return False, "Failed to retrieve login token from Justapedia API."

            # Step 2: Post login request
            login_payload = {
                "action": "login",
                "lgname": uname,
                "lgpassword": passwd,
                "lgtoken": login_token,
                "format": "json"
            }
            login_resp = await self.client.post(self.api_url, data=login_payload)
            login_resp.raise_for_status()
            res_data = login_resp.json()
            
            result = res_data.get("login", {}).get("result")
            if result == "Success":
                self.logged_in_user = res_data.get("login", {}).get("lgusername", uname)
                # Invalidate cached CSRF token so next write fetches fresh authenticated token
                self._csrf_token = None
                return True, f"Successfully logged in as {self.logged_in_user}"
            elif result == "NeedToken":
                return False, "Two-factor authentication or re-token required."
            elif result == "WrongPass":
                return False, "Incorrect password or bot password."
            elif result == "NotExists":
                return False, f"User account '{uname}' does not exist on Justapedia."
            else:
                reason = res_data.get("login", {}).get("reason", result)
                return False, f"Login failed: {reason}"
        except Exception as e:
            logger.error(f"Login error: {e}")
            return False, f"Login exception: {str(e)}"

    async def get_csrf_token(self, force_refresh: bool = False) -> str:
        """Fetch CSRF token for edit/write operations."""
        if not self.logged_in_user and (settings.JUSTAPEDIA_BOT_USERNAME and settings.JUSTAPEDIA_BOT_PASSWORD):
            try:
                await self.login()
            except Exception as e:
                logger.warning(f"Auto-login during get_csrf_token: {e}")

        if self._csrf_token and not force_refresh:
            return self._csrf_token

        params = {
            "action": "query",
            "meta": "tokens",
            "type": "csrf",
            "format": "json"
        }
        resp = await self.client.get(self.api_url, params=params)
        resp.raise_for_status()
        data = resp.json()
        token = data.get("query", {}).get("tokens", {}).get("csrftoken")
        if not token:
            raise ValueError("Could not retrieve CSRF token from MediaWiki API.")
        self._csrf_token = token
        return token

    async def get_article(self, title: str) -> Dict[str, Any]:
        """
        Fetch article metadata, latest revision wikitext, categories, and templates.
        """
        params = {
            "action": "query",
            "titles": title,
            "prop": "revisions|categories|templates|info",
            "rvprop": "ids|timestamp|user|content|comment",
            "rvslots": "main",
            "cllimit": 50,
            "tllimit": 50,
            "format": "json"
        }
        resp = await self.client.get(self.api_url, params=params)
        resp.raise_for_status()
        data = resp.json()
        
        pages = data.get("query", {}).get("pages", {})
        if not pages:
            return {"exists": False, "title": title}
            
        page_id = next(iter(pages.keys()))
        page = pages[page_id]
        
        if int(page_id) < 0 or "missing" in page:
            return {
                "exists": False,
                "title": title,
                "pageid": None,
                "revid": None,
                "timestamp": None,
                "wikitext": "",
                "categories": [],
                "templates": []
            }
            
        revisions = page.get("revisions", [])
        latest_rev = revisions[0] if revisions else {}
        slots = latest_rev.get("slots", {})
        wikitext = slots.get("main", {}).get("*", latest_rev.get("*", ""))
        
        categories = [c.get("title", "") for c in page.get("categories", [])]
        templates = [t.get("title", "") for t in page.get("templates", [])]
        
        return {
            "exists": True,
            "title": page.get("title", title),
            "pageid": page.get("pageid"),
            "revid": latest_rev.get("revid"),
            "timestamp": latest_rev.get("timestamp"),
            "user": latest_rev.get("user"),
            "wikitext": wikitext,
            "categories": categories,
            "templates": templates
        }

    async def check_exists(self, title: str) -> Tuple[bool, Optional[str]]:
        """Quick check if an article title exists or is a redirect."""
        params = {
            "action": "query",
            "titles": title,
            "redirects": 1,
            "format": "json"
        }
        resp = await self.client.get(self.api_url, params=params)
        resp.raise_for_status()
        data = resp.json()
        pages = data.get("query", {}).get("pages", {})
        for pid, p in pages.items():
            if int(pid) >= 0 and "missing" not in p:
                return True, p.get("title", title)
        return False, None

    async def search_articles(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Search articles on Justapedia by title or snippet."""
        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": limit,
            "format": "json"
        }
        resp = await self.client.get(self.api_url, params=params)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("query", {}).get("search", [])
        return results

    async def get_category_members(self, category_title: str, limit: int = 50, cmcontinue: Optional[str] = None) -> Dict[str, Any]:
        """
        Get members of a category (articles, subcategories).
        category_title can be 'Category:Deaths in 2024' or just 'Deaths in 2024'.
        """
        cat = category_title.strip()
        if not cat.lower().startswith("category:"):
            cat = f"Category:{cat}"

        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": cat,
            "cmlimit": limit,
            "cmprop": "title|ids|type|timestamp",
            "format": "json"
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue

        resp = await self.client.get(self.api_url, params=params)
        resp.raise_for_status()
        data = resp.json()
        
        members = data.get("query", {}).get("categorymembers", [])
        continue_code = data.get("continue", {}).get("cmcontinue")
        
        return {
            "category": cat,
            "members": members,
            "continue": continue_code
        }

    async def save_article(
        self,
        title: str,
        wikitext: str,
        summary: str,
        basetimestamp: Optional[str] = None,
        is_minor: bool = False,
        is_bot: bool = False,
        use_sandbox: Optional[bool] = None,
        user_session: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Publish approved wikitext directly to Justapedia Wiki.
        Ensures authenticated session (supporting user OAuth or user credentials),
        manages CSRF tokens, and handles conflict protection.
        """
        target_title = title
        is_sandbox = False
        
        # When use_sandbox is explicitly False, do NOT use sandbox
        should_use_sandbox = False
        if use_sandbox is True:
            should_use_sandbox = True
        elif use_sandbox is None and settings.SAFE_TEST_MODE:
            should_use_sandbox = True

        if should_use_sandbox:
            target_title = settings.SANDBOX_PAGE_TITLE
            is_sandbox = True
            wikitext = (
                f"<!-- TEST DRAFT FOR [{title}] VIA JUSTAPEDIA EDITORIAL ASSISTANT -->\n"
                f"{{{{Please leave this line alone (sandbox heading)}}}}\n\n"
                f"{wikitext}"
            )
            summary = f"[TEST] Draft for {title}: {summary}"

        data = None

        # Scenario A: Authenticated user session provided (OAuth or direct user cookies)
        if user_session:
            auth_type = user_session.get("auth_type", "credentials")
            sess_data = user_session.get("session_data", {})

            if auth_type == "oauth":
                try:
                    from requests_oauthlib import OAuth1Session
                    oauth_tok = sess_data.get("oauth_token")
                    oauth_sec = sess_data.get("oauth_token_secret")
                    oauth = OAuth1Session(
                        client_key=settings.OAUTH_CONSUMER_KEY,
                        client_secret=settings.OAUTH_CONSUMER_SECRET,
                        resource_owner_key=oauth_tok,
                        resource_owner_secret=oauth_sec
                    )
                    t_resp = oauth.get(f"{self.api_url}?action=query&meta=tokens&type=csrf&format=json", headers=self.headers, timeout=20)
                    csrf_token = t_resp.json().get("query", {}).get("tokens", {}).get("csrftoken")
                    if not csrf_token:
                        return {"success": False, "title": target_title, "message": "Failed to retrieve CSRF token via OAuth."}

                    payload = {
                        "action": "edit",
                        "title": target_title,
                        "text": wikitext,
                        "summary": summary,
                        "token": csrf_token,
                        "format": "json"
                    }
                    if is_minor: payload["minor"] = 1
                    if is_bot: payload["bot"] = 1
                    if basetimestamp and not is_sandbox: payload["basetimestamp"] = basetimestamp

                    resp = oauth.post(self.api_url, data=payload, headers=self.headers, timeout=25)
                    data = resp.json()
                except Exception as oauth_err:
                    logger.error(f"OAuth edit error: {oauth_err}")
                    return {"success": False, "title": target_title, "message": f"OAuth publish failed: {str(oauth_err)}"}

            else:
                # Direct credentials (cookies)
                try:
                    cookies = sess_data.get("cookies", {})
                    async with httpx.AsyncClient(headers=self.headers, cookies=cookies, timeout=30.0, follow_redirects=True) as u_client:
                        t_resp = await u_client.get(self.api_url, params={"action": "query", "meta": "tokens", "type": "csrf", "format": "json"})
                        t_resp.raise_for_status()
                        csrf_token = t_resp.json().get("query", {}).get("tokens", {}).get("csrftoken")
                        if not csrf_token:
                            return {"success": False, "title": target_title, "message": "Failed to retrieve CSRF token with session cookies."}

                        payload = {
                            "action": "edit",
                            "title": target_title,
                            "text": wikitext,
                            "summary": summary,
                            "token": csrf_token,
                            "format": "json"
                        }
                        if is_minor: payload["minor"] = 1
                        if is_bot: payload["bot"] = 1
                        if basetimestamp and not is_sandbox: payload["basetimestamp"] = basetimestamp

                        resp = await u_client.post(self.api_url, data=payload)
                        resp.raise_for_status()
                        data = resp.json()
                except Exception as cred_err:
                    logger.error(f"Session cookies edit error: {cred_err}")
                    return {"success": False, "title": target_title, "message": f"Session publish failed: {str(cred_err)}"}

        else:
            # Scenario B: Fallback to server-level bot credentials if present
            if not self.logged_in_user and (settings.JUSTAPEDIA_BOT_USERNAME and settings.JUSTAPEDIA_BOT_PASSWORD):
                logger.info("Session not authenticated. Logging in with configured bot credentials...")
                await self.login()

            if not self.logged_in_user:
                return {
                    "success": False,
                    "title": target_title,
                    "message": "Cannot publish: You must be logged in with your Justapedia account.",
                    "raw_response": None
                }

            csrf_token = await self.get_csrf_token()
            payload = {
                "action": "edit",
                "title": target_title,
                "text": wikitext,
                "summary": summary,
                "token": csrf_token,
                "format": "json"
            }
            if is_minor: payload["minor"] = 1
            if is_bot: payload["bot"] = 1
            if basetimestamp and not is_sandbox: payload["basetimestamp"] = basetimestamp

            resp = await self.client.post(self.api_url, data=payload)
            resp.raise_for_status()
            data = resp.json()

        # Check for MediaWiki error responses
        if "error" in data:
            error_code = data["error"].get("code", "unknown")
            error_info = data["error"].get("info", "Unknown API error")
            
            # If token expired or permission error, re-login and retry once
            if error_code in ["badtoken", "notoken", "permissiondenied", "assertuserfailed", "mustbeloggedin"]:
                logger.info(f"Received {error_code} from wiki. Re-authenticating and retrying save...")
                login_ok, login_msg = await self.login()
                if login_ok:
                    csrf_token = await self.get_csrf_token(force_refresh=True)
                    payload["token"] = csrf_token
                    retry_resp = await self.client.post(self.api_url, data=payload)
                    retry_resp.raise_for_status()
                    data = retry_resp.json()
                    if "error" in data:
                        return {
                            "success": False,
                            "title": target_title,
                            "message": f"API Error ({data['error'].get('code')}): {data['error'].get('info')}",
                            "raw_response": data
                        }
                else:
                    return {
                        "success": False,
                        "title": target_title,
                        "message": f"Login re-authentication failed: {login_msg}",
                        "raw_response": data
                    }
            elif error_code == "editconflict":
                # If basetimestamp caused edit conflict, retry once without basetimestamp since user explicitly approved
                if "basetimestamp" in payload:
                    logger.info("Edit conflict encountered with basetimestamp. Retrying direct overwrite...")
                    del payload["basetimestamp"]
                    retry_resp = await self.client.post(self.api_url, data=payload)
                    retry_resp.raise_for_status()
                    data = retry_resp.json()
                    if "error" in data:
                        return {
                            "success": False,
                            "title": target_title,
                            "message": f"Edit Conflict on Justapedia: {data['error'].get('info')}",
                            "raw_response": data
                        }
                else:
                    return {
                        "success": False,
                        "title": target_title,
                        "message": "Edit Conflict: This article was modified on Justapedia by another editor since you loaded it.",
                        "raw_response": data
                    }
            else:
                return {
                    "success": False,
                    "title": target_title,
                    "message": f"API Error ({error_code}): {error_info}",
                    "raw_response": data
                }

        edit_result = data.get("edit", {})
        if edit_result.get("result") == "Success":
            new_revid = edit_result.get("newrevid")
            nochange = "nochange" in edit_result
            url = f"https://justapedia.org/{target_title.replace(' ', '_')}"
            
            msg = "Saved successfully to Justapedia Wiki!" if not nochange else "Page content unchanged."
            if is_sandbox:
                msg += f" (Safely saved to {target_title})"
                
            return {
                "success": True,
                "title": target_title,
                "revid": new_revid,
                "url": url,
                "is_sandbox": is_sandbox,
                "message": msg,
                "raw_response": data
            }
        else:
            return {
                "success": False,
                "title": target_title,
                "message": f"Unexpected response from wiki: {data}",
                "raw_response": data
            }

# Global singleton client instance
justapedia_client = JustapediaClient()
