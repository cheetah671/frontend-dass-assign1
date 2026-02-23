import axios from 'axios';

const DEFAULT_LOCAL_API_URL = 'http://localhost:5001';
const DEFAULT_PROD_API_URL = 'https://backend-dass-j59i.onrender.com';

const envApiUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;
const isBrowser = typeof window !== 'undefined';
const isLocalHost =
  isBrowser &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const isLocalApiUrl = typeof envApiUrl === 'string' && /localhost|127\.0\.0\.1/.test(envApiUrl);

const API_URL = envApiUrl
  ? !isLocalHost && isLocalApiUrl
    ? DEFAULT_PROD_API_URL
    : envApiUrl
  : isLocalHost
    ? DEFAULT_LOCAL_API_URL
    : DEFAULT_PROD_API_URL;

const normalizeBaseUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return url;
  const clean = url.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

const api = axios.create({
    baseURL: normalizeBaseUrl(API_URL),
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
