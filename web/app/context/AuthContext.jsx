"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchCurrentUser = useCallback(async () => {
    // Periksa token backend asli
    const token = api.getAccessToken();
    const refreshToken = api.getRefreshToken();
    if (!token && !refreshToken) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const sessionVersion = api.sessionVersion;
      const response = await api.get('/auth/me', {}, { silent: true });
      if (sessionVersion !== api.sessionVersion || (!api.getAccessToken() && !api.getRefreshToken())) return null;
      if (response && response.success) {
        const userData =
          response.data?.user ||
          (response.data && typeof response.data === 'object' && response.data.email ? response.data : null) ||
          response.message?.user ||
          (response.message && typeof response.message === 'object' && response.message.email ? response.message : null);

        if (userData) {
          api.setStoredUser(userData, api.isPersistentSession());
          setUser(userData);
          setLoading(false);
          return userData;
        }
      }
      setUser(null);
      setLoading(false);
      return null;
    } catch (error) {
      const status = error?.status;

      if (status === 401) {
        api.clearTokens();
        setUser(null);
      } else if (status === 422) {
        if (api.isInvalidTokenError(error)) {
          api.clearTokens();
        }
        setUser(null);
      } else {
        setUser(null);
      }

      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    const onSessionCleared = () => {
      setUser(null);
      setLoading(false);
    };
    const unsubscribe = api.subscribeSessionCleared(onSessionCleared, () => {
      fetchCurrentUser();
    });
    const t = setTimeout(() => {
      fetchCurrentUser();
    }, 0);
    return () => {
      clearTimeout(t);
      unsubscribe();
    };
  }, [fetchCurrentUser]);

  const login = async (email, password, rememberMe = false) => {
    const trimmedEmail = (email || '').trim();

    try {
      const response = await api.post('/auth/login', { email: trimmedEmail, password });
      
      if (response && response.success) {
        const payload =
          (response.data && typeof response.data === 'object' && (response.data.access_token || response.data.user))
            ? response.data
            : (response.message && typeof response.message === 'object' && (response.message.access_token || response.message.user))
            ? response.message
            : response.data || {};

        const access_token = payload.access_token;
        const refresh_token = payload.refresh_token;
        const userData = payload.user || (payload.email ? payload : null);

        if (access_token && userData) {
          // Store tokens in single isolated store (purge any prior role session from local/session storage)
          api.setSession({
            accessToken: access_token,
            refreshToken: refresh_token || null,
            userData,
            remember: rememberMe,
          });
          setUser(userData);
          setLoading(false);

          return { success: true, user: userData };
        }
      }
      
      api.clearTokens();
      setUser(null);
      setLoading(false);
      return {
        success: false,
        status: response?.status || 400,
        message: response?.message || 'Login failed',
      };
    } catch (error) {
      api.clearTokens();
      setUser(null);
      setLoading(false);

      const status = error.status || 500;
      let userFriendlyMessage = error.message || 'Login failed';

      if (status >= 500) {
        userFriendlyMessage = 'Terjadi kesalahan pada server (HTTP 500). Backend mengalami masalah internal saat memproses autentikasi. Silakan periksa konfigurasi server atau hubungi administrator.';
      } else if (status === 401 || (status === 400 && (/invalid email or password/i.test(error.message || '') || /validation failed/i.test(error.message || '')))) {
        userFriendlyMessage = 'Email atau password yang Anda masukkan salah. Silakan periksa kembali.';
      } else if (status === 400 && /email dan password harus diisi/i.test(error.message || '')) {
        userFriendlyMessage = 'Email dan password harus diisi.';
      }

      return {
        success: false,
        status,
        message: userFriendlyMessage,
        rawMessage: error.message,
        errors: error.errors || null,
      };
    }
  };

  const register = async (name, email, phone, password) => {
    try {
      const trimmedName = (name || '').trim();
      const trimmedEmail = (email || '').trim();
      const trimmedPhone = (phone || '').trim();

      const response = await api.post('/auth/register', {
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        password,
      });
      
      if (response && response.success) {
        const payload =
          (response.data && typeof response.data === 'object' && (response.data.user || response.data.verification_token))
            ? response.data
            : (response.message && typeof response.message === 'object' && (response.message.user || response.message.verification_token))
            ? response.message
            : response.data || {};

        if (typeof window !== 'undefined' && payload.verification_token) {
          sessionStorage.setItem('ticketwave_verification_token', payload.verification_token);
        }

        const registeredUser = payload.user || payload;

        // Auto login setelah pendaftaran berhasil
        const loginResult = await login(trimmedEmail, password, false);
        if (loginResult.success) {
          return loginResult;
        }

        return {
          success: false,
          registered: true,
          status: 201,
          message: 'Akun berhasil didaftarkan! Silakan lakukan login secara manual.',
          user: registeredUser,
        };
      }
      
      return {
        success: false,
        status: response?.status || 400,
        message: response?.message || 'Registration failed',
      };
    } catch (error) {
      const status = error.status || 400;
      let userFriendlyMessage = error.message || 'Registration failed';

      if (status >= 500) {
        userFriendlyMessage = 'Terjadi kesalahan pada server saat pendaftaran (HTTP 500). Silakan coba beberapa saat lagi.';
      }

      return {
        success: false,
        status,
        message: userFriendlyMessage,
        rawMessage: error.message,
        errors: error.errors || null,
      };
    }
  };

  const logout = useCallback(async () => {
    try {
      if (api.getAccessToken()) {
        await api.post(
          '/auth/logout',
          { refresh_token: api.getRefreshToken() || undefined },
          { silent: true }
        );
      }
    } catch {
      // Tetap lanjut bersihkan sesi lokal meskipun revoke token gagal (mis. sudah expired)
    } finally {
      api.clearTokens();
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    fetchCurrentUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isOfficer: user?.role === 'officer',
    isUser: user?.role === 'user',
    isDemoSession: false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
