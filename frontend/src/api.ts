import { 
  ArticleJob, AppSettings, WikiTestConnectionResponse, 
  SaveToWikiResponse, OllamaTestResponse, AuthUser,
  OAuthInitiateResponse, LoginResponse 
} from './types';

const BASE_URL = ''; // Handled by Vite proxy in dev or FastAPI in prod

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('justapedia_auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Authentication
  async getMe(): Promise<AuthUser> {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<AuthUser>(res);
  },

  async loginCredentials(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await handleResponse<LoginResponse>(res);
    if (data.session_token) {
      localStorage.setItem('justapedia_auth_token', data.session_token);
    }
    return data;
  },

  async initiateOAuth(): Promise<OAuthInitiateResponse> {
    const res = await fetch(`${BASE_URL}/api/auth/oauth/initiate`, {
      method: 'POST'
    });
    return handleResponse<OAuthInitiateResponse>(res);
  },

  async completeOAuth(oauth_token: string, oauth_verifier: string): Promise<LoginResponse> {
    const res = await fetch(`${BASE_URL}/api/auth/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oauth_token, oauth_verifier })
    });
    const data = await handleResponse<LoginResponse>(res);
    if (data.session_token) {
      localStorage.setItem('justapedia_auth_token', data.session_token);
    }
    return data;
  },

  async logout(): Promise<any> {
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { ...getAuthHeader() }
      });
    } finally {
      localStorage.removeItem('justapedia_auth_token');
    }
    return { success: true };
  },

  async loginWiki(payload: { username?: string; password?: string }): Promise<any> {
    return this.loginCredentials(payload.username || '', payload.password || '');
  },

  // Articles
  async getArticles(params?: { status?: string; mode?: string; priority?: string; search?: string }): Promise<ArticleJob[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.mode) searchParams.set('mode', params.mode);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.search) searchParams.set('search', params.search);
    const res = await fetch(`${BASE_URL}/api/articles?${searchParams.toString()}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<ArticleJob[]>(res);
  },

  async getArticle(id: number, title?: string): Promise<ArticleJob> {
    const q = title ? `?title=${encodeURIComponent(title)}` : '';
    const res = await fetch(`${BASE_URL}/api/articles/${id}${q}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<ArticleJob>(res);
  },

  async researchArticle(id: number, title?: string): Promise<ArticleJob> {
    const q = title ? `?title=${encodeURIComponent(title)}` : '';
    const res = await fetch(`${BASE_URL}/api/articles/${id}/research${q}`, { 
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<ArticleJob>(res);
  },

  async generateDraft(id: number, title?: string): Promise<ArticleJob> {
    const q = title ? `?title=${encodeURIComponent(title)}` : '';
    const res = await fetch(`${BASE_URL}/api/articles/${id}/generate${q}`, { 
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<ArticleJob>(res);
  },

  async updateDraft(id: number, wikitext: string, title?: string): Promise<ArticleJob> {
    const q = title ? `?title=${encodeURIComponent(title)}` : '';
    const res = await fetch(`${BASE_URL}/api/articles/${id}/draft${q}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ wikitext })
    });
    return handleResponse<ArticleJob>(res);
  },

  async saveToJustapedia(id: number, options: {
    custom_title?: string;
    wikitext: string;
    edit_summary: string;
    is_minor?: boolean;
    is_bot?: boolean;
    use_sandbox?: boolean;
  }, title?: string): Promise<SaveToWikiResponse> {
    const q = title ? `?title=${encodeURIComponent(title)}` : '';
    const res = await fetch(`${BASE_URL}/api/articles/${id}/save${q}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(options)
    });
    return handleResponse<SaveToWikiResponse>(res);
  },

  async skipArticle(id: number): Promise<ArticleJob> {
    const res = await fetch(`${BASE_URL}/api/articles/${id}/skip`, { 
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<ArticleJob>(res);
  },

  async deleteArticle(id: number): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/api/articles/${id}`, { 
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<{ message: string }>(res);
  },

  // Discovery
  async discoverDeceased(category_name?: string, limit: number = 50, filter_incomplete_only: boolean = true): Promise<ArticleJob[]> {
    const res = await fetch(`${BASE_URL}/api/discovery/deceased`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({
        category_name: category_name || 'Category:2024 deaths',
        limit,
        filter_incomplete_only
      })
    });
    return handleResponse<ArticleJob[]>(res);
  },

  async discoverCategory(category_name: string, limit: number = 25, filter_incomplete_only: boolean = false): Promise<ArticleJob[]> {
    const res = await fetch(`${BASE_URL}/api/discovery/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({
        category_name,
        limit,
        filter_incomplete_only
      })
    });
    return handleResponse<ArticleJob[]>(res);
  },

  async addSpecificArticles(titles: string[]): Promise<ArticleJob[]> {
    const res = await fetch(`${BASE_URL}/api/discovery/specific`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ titles })
    });
    return handleResponse<ArticleJob[]>(res);
  },

  // Batch
  async batchResearch(job_ids: number[]): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/batch/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ job_ids })
    });
    return handleResponse<any>(res);
  },

  async batchGenerate(job_ids: number[]): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/batch/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ job_ids })
    });
    return handleResponse<any>(res);
  },

  // Settings
  async getSettings(): Promise<AppSettings> {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<AppSettings>(res);
  },

  async updateSettings(payload: Partial<AppSettings>): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    return handleResponse<any>(res);
  },

  async testWikiConnection(): Promise<WikiTestConnectionResponse> {
    const res = await fetch(`${BASE_URL}/api/settings/test-wiki`, { 
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    return handleResponse<WikiTestConnectionResponse>(res);
  },

  async testOllamaConnection(baseUrl?: string): Promise<OllamaTestResponse> {
    const res = await fetch(`${BASE_URL}/api/settings/test-ollama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(baseUrl ? { base_url: baseUrl } : {})
    });
    return handleResponse<OllamaTestResponse>(res);
  }
};
