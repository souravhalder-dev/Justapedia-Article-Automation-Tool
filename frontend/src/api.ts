import { ArticleJob, AppSettings, WikiTestConnectionResponse, SaveToWikiResponse, OllamaTestResponse } from './types';

const BASE_URL = ''; // Relative path, handled by Vite proxy in dev or FastAPI in prod

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Articles
  async getArticles(params?: { status?: string; mode?: string; priority?: string; search?: string }): Promise<ArticleJob[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.mode) searchParams.set('mode', params.mode);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.search) searchParams.set('search', params.search);
    const res = await fetch(`${BASE_URL}/api/articles?${searchParams.toString()}`);
    return handleResponse<ArticleJob[]>(res);
  },

  async getArticle(id: number, title?: string): Promise<ArticleJob> {
    const q = title ? `?title=${encodeURIComponent(title)}` : '';
    const res = await fetch(`${BASE_URL}/api/articles/${id}${q}`);
    return handleResponse<ArticleJob>(res);
  },

  async researchArticle(id: number, title?: string): Promise<ArticleJob> {
    const q = title ? `?title=${encodeURIComponent(title)}` : '';
    const res = await fetch(`${BASE_URL}/api/articles/${id}/research${q}`, { method: 'POST' });
    return handleResponse<ArticleJob>(res);
  },

  async generateDraft(id: number, title?: string): Promise<ArticleJob> {
    const q = title ? `?title=${encodeURIComponent(title)}` : '';
    const res = await fetch(`${BASE_URL}/api/articles/${id}/generate${q}`, { method: 'POST' });
    return handleResponse<ArticleJob>(res);
  },

  async updateDraft(id: number, wikitext: string, title?: string): Promise<ArticleJob> {
    const q = title ? `?title=${encodeURIComponent(title)}` : '';
    const res = await fetch(`${BASE_URL}/api/articles/${id}/draft${q}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    return handleResponse<SaveToWikiResponse>(res);
  },

  async skipArticle(id: number): Promise<ArticleJob> {
    const res = await fetch(`${BASE_URL}/api/articles/${id}/skip`, { method: 'POST' });
    return handleResponse<ArticleJob>(res);
  },

  async deleteArticle(id: number): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/api/articles/${id}`, { method: 'DELETE' });
    return handleResponse<{ message: string }>(res);
  },

  // Discovery
  async discoverDeceased(category_name?: string, limit: number = 20, filter_incomplete_only: boolean = true): Promise<ArticleJob[]> {
    const res = await fetch(`${BASE_URL}/api/discovery/deceased`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_name: category_name || 'Category:Deaths in 2024',
        limit,
        filter_incomplete_only
      })
    });
    return handleResponse<ArticleJob[]>(res);
  },

  async discoverCategory(category_name: string, limit: number = 25, filter_incomplete_only: boolean = false): Promise<ArticleJob[]> {
    const res = await fetch(`${BASE_URL}/api/discovery/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles })
    });
    return handleResponse<ArticleJob[]>(res);
  },

  // Batch
  async batchResearch(job_ids: number[]): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/batch/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_ids })
    });
    return handleResponse<any>(res);
  },

  async batchGenerate(job_ids: number[]): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/batch/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_ids })
    });
    return handleResponse<any>(res);
  },

  // Settings
  async getSettings(): Promise<AppSettings> {
    const res = await fetch(`${BASE_URL}/api/settings`);
    return handleResponse<AppSettings>(res);
  },

  async updateSettings(payload: Partial<AppSettings>): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<any>(res);
  },

  async testWikiConnection(): Promise<WikiTestConnectionResponse> {
    const res = await fetch(`${BASE_URL}/api/settings/test-wiki`, { method: 'POST' });
    return handleResponse<WikiTestConnectionResponse>(res);
  },

  async testOllamaConnection(baseUrl?: string): Promise<OllamaTestResponse> {
    const res = await fetch(`${BASE_URL}/api/settings/test-ollama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseUrl ? { base_url: baseUrl } : {})
    });
    return handleResponse<OllamaTestResponse>(res);
  },

  async loginWiki(payload: { username?: string; password?: string }): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/settings/login-wiki`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<any>(res);
  }
};
