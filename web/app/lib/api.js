/**
 * API Client untuk TicketWave Backend
 * Base: http://127.0.0.1:5000/api
 * 
 * Features:
 * - Auto token injection from localStorage
 * - Auto refresh token when 401
 * - Response normalization (handles auth route data/message swap in BE)
 * - Structured validation error formatting
 */

import { fetchJSON } from './http.js';

const SESSION_CLEARED_EVENT = 'ticketwave:session-cleared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';

function normalizeResponse(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  // Di app/modules/auth/routes.py BE, success_response dipanggil dengan urutan (message_str, data_obj)
  // sedangkan app/utils/responses.py mendefinisikan success_response(data=None, message="Success").
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

  if (
    raw.success === true &&
    typeof raw.data === 'string' &&
    raw.message === 'Success'
  ) {
    return {
      ...raw,
      message: raw.data,
    };
  }

  return raw;
}

function formatErrorMessage(data, status) {
  if (!data) return `HTTP ${status}`;

  // Jika data.message berupa object (contoh: checkout_routes.py memanggil error_response(errors, 400))
  if (data.message && typeof data.message === 'object') {
    const parts = Object.entries(data.message).map(([field, msgs]) => {
      const text = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
      return `${field}: ${text}`;
    });
    if (parts.length > 0) return parts.join(' | ');
  }

  // Jika ada detail errors dari Marshmallow (contoh: status 422 pada agency/event/phase)
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

  return `HTTP ${status}`;
}

function isInvalidTokenError(error) {
  if (!error) return false;

  const data = error.data || error.raw || {};
  const candidates = [
    typeof data.msg === 'string' ? data.msg : '',
    typeof data.message === 'string' ? data.message : '',
    typeof data.error === 'string' ? data.error : '',
    typeof error.message === 'string' ? error.message : '',
  ];

  // Field validation errors (e.g. Marshmallow { errors: { field: [...] } }) are not token errors
  const hasValidationErrors =
    (data.errors && typeof data.errors === 'object' && Object.keys(data.errors).length > 0) ||
    (error.errors && typeof error.errors === 'object' && Object.keys(error.errors).length > 0);
  if (hasValidationErrors) {
    return false;
  }

  const combined = candidates.join(' ').toLowerCase().trim();
  if (!combined) return false;

  return /not enough segments|too many segments|invalid (?:header|crypto) padding|bad authorization header|signature verification failed|only (?:non-refresh|refresh) tokens are allowed|(?:token|jwt).*(?:invalid|expired|malformed|revoked|not yet valid)|(?:invalid|expired|malformed|revoked).*(?:token|jwt)|(?:invalid|missing) claim|(?:issuer|audience).*(?:invalid|does not match)/i.test(combined);
}

class APIClient {
  constructor(baseURL = API_BASE) {
    this.baseURL = baseURL;
    this.sessionVersion = 0;
  }

  isInvalidTokenError(error) {
    return isInvalidTokenError(error);
  }

  async request(endpoint, options = {}) {
    const requestSessionVersion = this.sessionVersion;
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getAccessToken();
    const { silent = false, ...fetchOptions } = options;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...fetchOptions.headers,
    };

    const config = {
      ...fetchOptions,
      headers,
    };

    try {
      const { response, raw: rawData } = await fetchJSON(url, config, { endpoint });
      const data = normalizeResponse(rawData);

      // Token expired or invalid on protected endpoints → try refresh
      const isAuthPublicEndpoint =
        endpoint.startsWith('/auth/login') ||
        endpoint.startsWith('/auth/register') ||
        endpoint.startsWith('/auth/verify-email') ||
        endpoint.startsWith('/auth/request-password-reset') ||
        endpoint.startsWith('/auth/reset-password');

      if (
        response.status === 401 &&
        !isAuthPublicEndpoint &&
        (token || this.getRefreshToken()) &&
        requestSessionVersion === this.sessionVersion
      ) {
        const refreshed = await this.refreshToken({ silent });
        if (refreshed) {
          const newToken = this.getAccessToken();
          const retryHeaders = {
            ...headers,
            'Authorization': `Bearer ${newToken}`,
          };
          const { response: retryResponse, raw: retryRaw } = await fetchJSON(url, { ...config, headers: retryHeaders }, { endpoint, retry: false });
          const retryData = normalizeResponse(retryRaw);
          if (!retryResponse.ok || (retryData && retryData.success === false)) {
            if (retryResponse.status === 401 && token) {
              this.clearTokens();
            }
            const err = new Error(formatErrorMessage(retryData, retryResponse.status));
            err.status = retryResponse.status;
            err.errors = retryData.errors || null;
            err.data = retryData;
            err.raw = retryRaw;
            throw err;
          }
          return retryData;
        } else if (token && !this.getRefreshToken()) {
          this.clearTokens();
        }
      }

      if (!response.ok || (data && data.success === false)) {
        const err = new Error(formatErrorMessage(data, response.status));
        err.status = response.status;
        err.errors = data.errors || (typeof data.message === 'object' ? data.message : null);
        err.data = data;
        err.raw = rawData;
        throw err;
      }

      return data;
    } catch (error) {
      if (error.status === 422 && requestSessionVersion === this.sessionVersion && isInvalidTokenError(error)) this.clearTokens();
      if (!silent) {
        console.error('[API Error]', endpoint.split('?')[0].replace(/(verify-email\/).+/, '$1[redacted]'), error.status || 'network');
      }
      if (!error.status && (error.name === 'TypeError' || error.message?.includes('fetch'))) {
        error.status = 0;
        error.message = `Gagal terhubung ke server backend (${this.baseURL}). Pastikan server backend sedang aktif.`;
      }
      throw error;
    }
  }

  async refreshToken(options = {}) {
    const key = `${this.sessionVersion}:${this.getRefreshToken() || ''}`;
    if (this.activeRefresh?.key === key) return this.activeRefresh.promise;
    const pending = { key, promise: this.performRefresh(options) };
    this.activeRefresh = pending;
    try {
      return await pending.promise;
    } finally {
      if (this.activeRefresh === pending) this.activeRefresh = null;
    }
  }

  async performRefresh(options = {}) {
    const { silent = false } = options;
    if (typeof window === 'undefined') return false;
    const sessionRefresh = sessionStorage.getItem('refresh_token');
    const localRefresh = localStorage.getItem('refresh_token');
    const refreshToken = sessionRefresh || localRefresh;
    if (!refreshToken) return false;

    const persistInLocal = !sessionRefresh && !!localRefresh;
    const sessionVersion = this.sessionVersion;

    try {
      const { response, raw: refreshRaw } = await fetchJSON(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
        },
      });

      if (sessionVersion !== this.sessionVersion || this.getRefreshToken() !== refreshToken) return false;
      if (!response.ok) {
        const rawErr = refreshRaw;
        const errData = normalizeResponse(rawErr);
        if (response.status >= 500) {
          const err = new Error(formatErrorMessage(errData, response.status));
          err.status = response.status;
          err.data = errData;
          err.raw = rawErr;
          throw err;
        }
        if (response.status === 401 || (response.status === 422 && isInvalidTokenError({ data: errData, message: formatErrorMessage(errData, response.status) }))) {
          this.clearTokens();
        }
        return false;
      }

      const rawData = refreshRaw;
      const data = normalizeResponse(rawData);
      const newAccessToken =
        data.data?.access_token ||
        data.message?.access_token ||
        (typeof data.data === 'string' && data.message?.access_token);
      if (data.success && newAccessToken) {
        if (sessionVersion !== this.sessionVersion || this.getRefreshToken() !== refreshToken) return false;
        this.setAccessToken(newAccessToken, persistInLocal);
        return true;
      }
      return false;
    } catch (error) {
      if (!silent) {
        console.error('[Token Refresh Failed]', error.status || 'network');
      }
      if (error?.status >= 500 || !error?.status) {
        throw error;
      }
      this.clearTokens();
      return false;
    }
  }

  // Token helpers (default: sessionStorage per-tab; localStorage hanya jika Remember Me aktif)
  isPersistentSession() {
    if (typeof window === 'undefined') return false;
    if (sessionStorage.getItem('access_token') || sessionStorage.getItem('refresh_token')) {
      return false;
    }
    return !!(localStorage.getItem('access_token') || localStorage.getItem('refresh_token'));
  }

  getAccessToken() {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
  }

  getRefreshToken() {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('refresh_token') || localStorage.getItem('refresh_token');
  }

  getStoredUser() {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  setAccessToken(token, remember = false) {
    if (typeof window !== 'undefined' && token) {
      if (remember) {
        localStorage.setItem('access_token', token);
        sessionStorage.removeItem('access_token');
      } else {
        sessionStorage.setItem('access_token', token);
        localStorage.removeItem('access_token');
      }
    }
  }

  setRefreshToken(token, remember = false) {
    if (typeof window !== 'undefined' && token) {
      if (remember) {
        localStorage.setItem('refresh_token', token);
        sessionStorage.removeItem('refresh_token');
      } else {
        sessionStorage.setItem('refresh_token', token);
        localStorage.removeItem('refresh_token');
      }
    }
  }

  setStoredUser(userData, remember = false) {
    if (typeof window !== 'undefined' && userData) {
      const serialized = JSON.stringify(userData);
      if (remember) {
        localStorage.setItem('user', serialized);
        sessionStorage.removeItem('user');
      } else {
        sessionStorage.setItem('user', serialized);
        localStorage.removeItem('user');
      }
    }
  }

  setSession({ accessToken, refreshToken = null, userData = null, remember = false }) {
    this.sessionVersion++;
    if (typeof window === 'undefined') return;
    for (const store of [sessionStorage, localStorage]) {
      try {
        for (const key of [
          'access_token',
          'refresh_token',
          'user',
          'ticketwave_verification_token',
          'ticketwave_checkout',
          'ticketwave_payment_return_context',
        ]) {
          store.removeItem(key);
        }
      } catch {
        // Ignore storage errors and still attempt writing active session.
      }
    }
    this.setAccessToken(accessToken, remember);
    if (refreshToken) {
      this.setRefreshToken(refreshToken, remember);
    }
    if (userData) {
      this.setStoredUser(userData, remember);
    }
  }

  subscribeSessionCleared(listener, onExternalChange = null) {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (event) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === null || ['access_token', 'refresh_token', 'user'].includes(event.key)) {
        // Tab dengan sesi sessionStorage sendiri tidak boleh tertimpa perubahan localStorage tab lain
        if (sessionStorage.getItem('access_token') || sessionStorage.getItem('refresh_token')) {
          return;
        }
        if (!this.getAccessToken() && !this.getRefreshToken()) {
          this.sessionVersion++;
          listener();
        } else {
          this.sessionVersion++;
          if (typeof onExternalChange === 'function') {
            onExternalChange();
          }
        }
      }
    };
    window.addEventListener(SESSION_CLEARED_EVENT, listener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_CLEARED_EVENT, listener);
      window.removeEventListener('storage', onStorage);
    };
  }

  clearTokens() {
    this.sessionVersion++;
    if (typeof window !== 'undefined') {
      for (const name of ['sessionStorage', 'localStorage']) {
        try {
          const store = name === 'sessionStorage' ? sessionStorage : localStorage;
          for (const key of [
            'access_token',
            'refresh_token',
            'user',
            'ticketwave_verification_token',
            'ticketwave_checkout',
            'ticketwave_payment_return_context',
          ]) {
            store.removeItem(key);
          }
        } catch {
          // Storage may be blocked; React must still stop showing the cleared session.
        }
      }
      window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
    }
  }

  // HTTP methods
  async get(endpoint, params = {}, options = {}) {
    let actualParams = params;
    let actualOptions = options;

    if (
      params &&
      typeof params === 'object' &&
      ('silent' in params || 'headers' in params) &&
      Object.keys(options || {}).length === 0 &&
      !('page' in params || 'per_page' in params || 'search' in params || 'limit' in params)
    ) {
      actualOptions = { ...params };
      actualParams = {};
    }

    const cleanParams = {};
    Object.entries(actualParams || {}).forEach(([k, v]) => {
      if (k === 'silent') return;
      if (v !== undefined && v !== null && v !== '') {
        cleanParams[k] = v;
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { ...actualOptions, method: 'GET' });
  }

  async post(endpoint, body = {}, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put(endpoint, body = {}, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch(endpoint, body = {}, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  // Upload dengan multipart/form-data
  async upload(endpoint, formData) {
    const requestSessionVersion = this.sessionVersion;
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getAccessToken();

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const { response, raw: rawData } = await fetchJSON(url, {
        method: 'POST',
        headers,
        body: formData,
      }, { endpoint, retry: false });
      const data = normalizeResponse(rawData);

      // Token expired or invalid on protected endpoints → try refresh
      if (response.status === 401 && requestSessionVersion === this.sessionVersion) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          const newToken = this.getAccessToken();
          const { response: retryResponse, raw: retryRaw } = await fetchJSON(url, {
            method: 'POST',
            headers: {
              ...headers,
              'Authorization': `Bearer ${newToken}`,
            },
            body: formData,
          }, { endpoint, retry: false });
          const retryData = normalizeResponse(retryRaw);
          if (!retryResponse.ok || retryData.success === false) {
            if (retryResponse.status === 401) {
              this.clearTokens();
            }
            const err = new Error(formatErrorMessage(retryData, retryResponse.status));
            err.status = retryResponse.status;
            err.errors = retryData.errors || null;
            err.data = retryData;
            err.raw = retryRaw;
            throw err;
          }
          return retryData;
        } else if (!this.getRefreshToken()) {
          this.clearTokens();
        }
      }

      if (!response.ok || data.success === false) {
        const err = new Error(formatErrorMessage(data, response.status));
        err.status = response.status;
        err.errors = data.errors || null;
        err.data = data;
        err.raw = rawData;
        throw err;
      }

      return data;
    } catch (error) {
      if (error.status === 422 && requestSessionVersion === this.sessionVersion && isInvalidTokenError(error)) this.clearTokens();
      console.error('[Upload Error]', endpoint.split('?')[0], error.status || 'network');
      throw error;
    }
  }

  // Eksplisit sinkronisasi status pembayaran Sandbox/development (POST, bukan GET read-only)
  async syncPaymentStatus(bookingCode, options = {}) {
    return this.post(`/checkout/${encodeURIComponent(bookingCode)}/sync-payment-status`, {}, options);
  }

  // Health check endpoint (/health berada di root server, bukan /api/health)
  async checkHealth() {
    const rootUrl = this.baseURL.replace(/\/api\/?$/, '');
    const { response, raw } = await fetchJSON(`${rootUrl}/health`, { method: 'GET' }, { endpoint: '/health' });
    if (response.ok) {
      return raw;
    }
    throw new Error(`HTTP ${response.status}`);
  }
}

const api = new APIClient();

export default api;
