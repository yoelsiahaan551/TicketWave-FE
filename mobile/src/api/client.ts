import { Platform } from 'react-native';
import {
  getDefaultApiBaseUrl,
  isExplicitEnvApiUrlConfigured,
} from '../constants/Config';
import {
  clearAuthStorage,
  getCustomApiBaseUrl,
  getStoredAccessToken,
  getStoredRefreshToken,
  isWebSessionStorageActive,
  setCustomApiBaseUrl,
  setStoredAccessToken,
} from '../utils/storage';
import { ApiResponse } from '../types';

export class ApiError extends Error {
  status: number;
  errors?: Record<string, any> | null;
  data?: any;
  raw?: any;

  constructor(message: string, status: number, data?: any, raw?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = data?.errors || (typeof data?.message === 'object' ? data.message : null);
    this.data = data;
    this.raw = raw;
  }
}

function normalizeResponse(raw: any): ApiResponse<any> {
  if (!raw || typeof raw !== 'object') return raw;

  // Handle auth routes where success_response(message, data) is swapped relative to utility definition
  if (
    raw.success === true &&
    typeof raw.data === 'string' &&
    raw.message !== null &&
    typeof raw.message === 'object'
  ) {
    return {
      ...raw,
      data: raw.message,
      message: raw.data,
    };
  }

  if (raw.success === true && typeof raw.data === 'string' && raw.message === 'Success') {
    return {
      ...raw,
      message: raw.data,
    };
  }

  return raw;
}

function formatErrorMessage(data: any, status: number): string {
  if (!data) return `HTTP ${status}`;

  if (data.message && typeof data.message === 'object') {
    const parts = Object.entries(data.message).map(([field, msgs]) => {
      const text = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
      return `${field}: ${text}`;
    });
    if (parts.length > 0) return parts.join(' | ');
  }

  if (data.errors && typeof data.errors === 'object') {
    const parts = Object.entries(data.errors).map(([field, msgs]) => {
      const text = Array.isArray(msgs)
        ? msgs.map((m) => (typeof m === 'object' ? JSON.stringify(m) : m)).join(', ')
        : typeof msgs === 'object'
        ? JSON.stringify(msgs)
        : String(msgs);
      return `${field}: ${text}`;
    });
    if (parts.length > 0) {
      const prefix = typeof data.message === 'string' ? `${data.message} — ` : '';
      return `${prefix}${parts.join(' | ')}`;
    }
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (typeof data.msg === 'string' && data.msg.trim()) {
    return data.msg;
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }

  return `HTTP ${status}`;
}

export function isInvalidTokenError(error: any): boolean {
  if (!error) return false;
  const data = error.data || error.raw || {};
  const candidates = [
    typeof data.msg === 'string' ? data.msg : '',
    typeof data.message === 'string' ? data.message : '',
    typeof data.error === 'string' ? data.error : '',
    typeof error.message === 'string' ? error.message : '',
  ];

  const hasValidationErrors =
    (data.errors && typeof data.errors === 'object' && Object.keys(data.errors).length > 0) ||
    (error.errors && typeof error.errors === 'object' && Object.keys(error.errors).length > 0);
  if (hasValidationErrors) return false;

  const combined = candidates.join(' ').toLowerCase().trim();
  if (!combined) return false;

  const tokenErrorKeywords = [
    'token',
    'segment',
    'signature',
    'padding',
    'header',
    'authorization',
    'bearer',
    'decode',
    'algorithm',
    'crypto',
    'jwt',
    'claim',
    'issuer',
    'audience',
    'not yet valid',
  ];

  return tokenErrorKeywords.some((keyword) => combined.includes(keyword));
}

class MobileApiClient {
  private baseURL: string;
  private initialized: boolean = false;
  private sessionVersion: number = 0;
  private sessionClearedListeners = new Set<() => void>();
  private activeRefresh: { key: string; promise: Promise<boolean> } | null = null;

  constructor() {
    this.baseURL = getDefaultApiBaseUrl();
  }

  getSessionVersion(): number {
    return this.sessionVersion;
  }

  bumpSessionVersion(): number {
    this.sessionVersion += 1;
    return this.sessionVersion;
  }

  subscribeSessionCleared(listener: () => void): () => void {
    this.sessionClearedListeners.add(listener);
    return () => {
      this.sessionClearedListeners.delete(listener);
    };
  }

  private async clearSessionAndNotify(): Promise<void> {
    this.sessionVersion += 1;
    await clearAuthStorage();
    this.sessionClearedListeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  }

  async init(): Promise<string> {
    if (!this.initialized) {
      const defaultUrl = getDefaultApiBaseUrl();
      if (isExplicitEnvApiUrlConfigured()) {
        this.baseURL = defaultUrl;
      } else {
        const custom = await getCustomApiBaseUrl();
        this.baseURL = custom ? custom : defaultUrl;
      }
      this.initialized = true;
    }
    return this.baseURL;
  }

  getBaseUrl(): string {
    return this.baseURL;
  }

  async setBaseUrl(newUrl: string | null): Promise<string> {
    await setCustomApiBaseUrl(newUrl);
    if (newUrl && newUrl.trim()) {
      this.baseURL = newUrl.trim().replace(/\/+$/, '');
    } else {
      this.baseURL = getDefaultApiBaseUrl();
    }
    return this.baseURL;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit & { silent?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    await this.init();
    const requestSessionVersion = this.sessionVersion;
    const url = `${this.baseURL}${endpoint}`;
    const token = await getStoredAccessToken();
    const { silent = false, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
      const rawData = await response.json().catch(() => ({}));
      const data = normalizeResponse(rawData);

      const isAuthPublicEndpoint =
        endpoint.startsWith('/auth/login') ||
        endpoint.startsWith('/auth/register') ||
        endpoint.startsWith('/auth/verify-email') ||
        endpoint.startsWith('/auth/request-password-reset') ||
        endpoint.startsWith('/auth/reset-password');

      const isAuthError =
        (response.status === 401 ||
          (response.status === 422 && isInvalidTokenError({ data, raw: rawData }))) &&
        !isAuthPublicEndpoint &&
        requestSessionVersion === this.sessionVersion;

      if (isAuthError) {
        if (__DEV__ && !silent) {
          console.log(`[API Interceptor] Auth error ${response.status} on ${endpoint} (${formatErrorMessage(data, response.status)}). Attempting token refresh...`);
        }
        const refreshed = await this.refreshToken({ silent });
        if (refreshed && requestSessionVersion === this.sessionVersion) {
          const newToken = await getStoredAccessToken();
          const retryResponse = await fetch(url, {
            ...fetchOptions,
            headers: {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            },
          });
          const retryRaw = await retryResponse.json().catch(() => ({}));
          if (__DEV__ && !silent) {
            console.log(`[API Interceptor] Retry ${endpoint} completed with HTTP ${retryResponse.status}`);
          }
          const retryData = normalizeResponse(retryRaw);
          if (!retryResponse.ok && !retryData.success) {
            if (retryResponse.status === 401 && requestSessionVersion === this.sessionVersion) {
              await this.clearSessionAndNotify();
            }
            throw new ApiError(
              formatErrorMessage(retryData, retryResponse.status),
              retryResponse.status,
              retryData,
              retryRaw
            );
          }
          return retryData;
        } else if (requestSessionVersion === this.sessionVersion) {
          const refresh = await getStoredRefreshToken();
          if (!refresh) {
            await this.clearSessionAndNotify();
          }
        }
      }

      if (!response.ok && !data.success) {
        throw new ApiError(
          formatErrorMessage(data, response.status),
          response.status,
          data,
          rawData
        );
      }

      return data;
    } catch (error: any) {
      if (
        error?.status === 422 &&
        requestSessionVersion === this.sessionVersion &&
        isInvalidTokenError(error)
      ) {
        await this.clearSessionAndNotify();
      }
      if (__DEV__ && !silent) {
        console.warn('[API Error]', endpoint, this.baseURL, error?.message || error);
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Tidak dapat terhubung ke layanan TicketWave. Periksa koneksi Anda dan coba lagi.',
        0
      );
    }
  }

  async refreshToken(options: { silent?: boolean } = {}): Promise<boolean> {
    const refreshToken = await getStoredRefreshToken();
    const key = `${this.sessionVersion}:${refreshToken || ''}`;
    if (this.activeRefresh?.key === key) {
      return this.activeRefresh.promise;
    }
    const pending = { key, promise: this.performRefresh(options) };
    this.activeRefresh = pending;
    try {
      return await pending.promise;
    } finally {
      if (this.activeRefresh === pending) {
        this.activeRefresh = null;
      }
    }
  }

  private async performRefresh(options: { silent?: boolean } = {}): Promise<boolean> {
    const { silent = false } = options;
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) return false;

    const refreshSessionVersion = this.sessionVersion;
    const isSessionScopedWeb = await isWebSessionStorageActive();

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      if (
        refreshSessionVersion !== this.sessionVersion ||
        (await getStoredRefreshToken()) !== refreshToken
      ) {
        return false;
      }

      if (!response.ok) {
        const rawErr = await response.json().catch(() => ({}));
        const errData = normalizeResponse(rawErr);
        if (response.status >= 500) {
          throw new ApiError(formatErrorMessage(errData, response.status), response.status, errData, rawErr);
        }
        if (
          response.status === 401 ||
          (response.status === 422 &&
            isInvalidTokenError({
              data: errData,
              message: formatErrorMessage(errData, response.status),
            }))
        ) {
          await this.clearSessionAndNotify();
        }
        return false;
      }

      const rawData = await response.json();
      const data = normalizeResponse(rawData);
      if (data.success && data.data?.access_token) {
        if (
          refreshSessionVersion !== this.sessionVersion ||
          (await getStoredRefreshToken()) !== refreshToken
        ) {
          return false;
        }
        await setStoredAccessToken(data.data.access_token, !isSessionScopedWeb);
        return true;
      }
      return false;
    } catch (error: any) {
      if (!silent) {
        console.warn('[Token Refresh Failed]', error?.message);
      }
      if (error?.status >= 500 || !error?.status) {
        throw error;
      }
      if (refreshSessionVersion === this.sessionVersion) {
        await this.clearSessionAndNotify();
      }
      return false;
    }
  }

  async get<T = any>(
    endpoint: string,
    params: Record<string, any> = {},
    options: { silent?: boolean; headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    const cleanParams: Record<string, string> = {};
    Object.entries(params || {}).forEach(([k, v]) => {
      if (k === 'silent') return;
      if (v !== undefined && v !== null && v !== '') {
        cleanParams[k] = String(v);
      }
    });
    const qs = new URLSearchParams(cleanParams).toString();
    const url = qs ? `${endpoint}?${qs}` : endpoint;
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(
    endpoint: string,
    body: any = {},
    options: { silent?: boolean; headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T = any>(
    endpoint: string,
    body: any = {},
    options: { silent?: boolean; headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch<T = any>(
    endpoint: string,
    body: any = {},
    options: { silent?: boolean; headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T = any>(
    endpoint: string,
    options: { silent?: boolean; headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  private async sendMultipartUpload(
    url: string,
    headers: Record<string, string>,
    formData: FormData
  ): Promise<{ ok: boolean; status: number; data: any }> {
    if (Platform.OS === 'web') {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      const rawData = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data: rawData };
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      Object.entries(headers).forEach(([key, value]) => {
        if (value) {
          xhr.setRequestHeader(key, value);
        }
      });
      xhr.onload = () => {
        let parsed: any = {};
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          parsed = {};
        }
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          data: parsed,
        });
      };
      xhr.onerror = () => {
        reject(new Error('Gagal mengunggah file ke server. Periksa koneksi jaringan Anda.'));
      };
      xhr.ontimeout = () => {
        reject(new Error('Waktu unggah file habis (timeout).'));
      };
      xhr.send(formData as any);
    });
  }

  async upload<T = any>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    await this.init();
    const requestSessionVersion = this.sessionVersion;
    const url = `${this.baseURL}${endpoint}`;
    const token = await getStoredAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await this.sendMultipartUpload(url, headers, formData);
      const rawData = response.data;
      const data = normalizeResponse(rawData);

      if (response.status === 401 && requestSessionVersion === this.sessionVersion) {
        const refreshed = await this.refreshToken();
        if (refreshed && requestSessionVersion === this.sessionVersion) {
          const newToken = await getStoredAccessToken();
          const retryResponse = await this.sendMultipartUpload(
            url,
            {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            },
            formData
          );
          const retryRaw = retryResponse.data;
          const retryData = normalizeResponse(retryRaw);
          if (!retryResponse.ok && !retryData.success) {
            if (retryResponse.status === 401 && requestSessionVersion === this.sessionVersion) {
              await this.clearSessionAndNotify();
            }
            throw new ApiError(
              formatErrorMessage(retryData, retryResponse.status),
              retryResponse.status,
              retryData,
              retryRaw
            );
          }
          return retryData;
        }
      }

      if (!response.ok && !data.success) {
        throw new ApiError(
          formatErrorMessage(data, response.status),
          response.status,
          data,
          rawData
        );
      }

      return data;
    } catch (error: any) {
      if (
        error?.status === 422 &&
        requestSessionVersion === this.sessionVersion &&
        isInvalidTokenError(error)
      ) {
        await this.clearSessionAndNotify();
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError(error?.message || 'Upload failed', 0);
    }
  }

  async checkHealth(): Promise<{ status: string; service?: string }> {
    await this.init();
    const rootUrl = this.baseURL.replace(/\/api\/?$/, '');
    const response = await fetch(`${rootUrl}/health`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  }
}

export const api = new MobileApiClient();
export default api;
