import axios, { AxiosError } from 'axios';
import type { ApiErrorPayload } from '../types';

export const TOKEN_STORAGE_KEY = 'taskflow_auth_token';

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorPayload>) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    if (status === 401 && !isAuthEndpoint && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

export function extractApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const data = error.response?.data;
    return {
      message: data?.error || error.message || fallback,
      fieldErrors: data?.fieldErrors || {},
    };
  }
  if (error instanceof Error) {
    return { message: error.message, fieldErrors: {} };
  }
  return { message: fallback, fieldErrors: {} };
}
