export interface SourceEvidence {
  id?: number;
  url: string;
  title: string;
  publisher?: string;
  publish_date?: string;
  snippet?: string;
  is_verified: boolean;
  reliability_score: number;
}

export interface Discrepancy {
  field: string;
  issue: string;
  sources_involved: string[];
}

export interface DiffChunk {
  type: 'equal' | 'modify' | 'delete' | 'insert';
  orig_lines: string[];
  prop_lines: string[];
}

export interface DiffJson {
  chunks: DiffChunk[];
  lines_added: number;
  lines_removed: number;
  added_sections: string[];
  added_refs: number;
  death_date_changed: boolean;
  summary: string;
}

export interface ArticleJob {
  id: number;
  title: string;
  mode: 'deceased' | 'category' | 'specific';
  category?: string;
  status: 'discovered' | 'analyzed' | 'researching' | 'draft_ready' | 'saved' | 'skipped' | 'error';
  priority: 'high' | 'medium' | 'low';
  audit_flags: string[];
  audit_summary?: string;
  page_exists: boolean;
  original_wikitext?: string;
  original_revid?: number;
  original_timestamp?: string;
  researched_facts?: Record<string, any>;
  discrepancies?: Discrepancy[];
  generated_draft?: string;
  user_edited_draft?: string;
  diff_summary?: string;
  diff_json?: DiffJson;
  edit_summary?: string;
  saved_revid?: number;
  saved_timestamp?: string;
  saved_url?: string;
  is_sandbox_save: boolean;
  error_message?: string;
  created_at: string;
  updated_at: string;
  sources: SourceEvidence[];
}

export interface AppSettings {
  justapedia_api_url: string;
  justapedia_bot_username: string;
  justapedia_has_password: boolean;
  justapedia_bot_password_masked: string;
  ai_provider?: 'ollama' | 'rule_based' | 'gemini';
  ollama_base_url?: string;
  ollama_model?: string;
  gemini_has_key: boolean;
  gemini_key_masked: string;
  gemini_model: string;
  safe_test_mode: boolean;
  sandbox_page_title: string;
}

export interface OllamaTestResponse {
  connected: boolean;
  models: string[];
  current_model: string;
  base_url: string;
  message: string;
}

export interface WikiTestConnectionResponse {
  connected: boolean;
  sitename?: string;
  generator?: string;
  logged_in: boolean;
  username?: string;
  can_write: boolean;
  message: string;
}

export interface SaveToWikiResponse {
  success: boolean;
  title: string;
  revid?: number;
  url?: string;
  is_sandbox: boolean;
  editor?: string;
  message: string;
}

export interface AuthUser {
  logged_in: boolean;
  username?: string | null;
  auth_type?: 'oauth' | 'credentials' | null;
}

export interface OAuthInitiateResponse {
  success: boolean;
  oauth_token: string;
  authorize_url: string;
}

export interface LoginResponse {
  success: boolean;
  session_token: string;
  username: string;
  auth_type: string;
}
