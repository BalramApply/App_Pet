import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const ACCESS_KEY = 'pj_admin_access';
const REFRESH_KEY = 'pj_admin_refresh';

// sessionStorage: tokens vanish when the tab closes
export const tokens = {
  get access() {
    return sessionStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return sessionStorage.getItem(REFRESH_KEY);
  },
  set(access, refresh) {
    sessionStorage.setItem(ACCESS_KEY, access);
    sessionStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  },
};

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.';

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

api.interceptors.request.use((config) => {
  if (tokens.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  return config;
});

let refreshing = null;

const refreshTokens = () => {
  if (!refreshing) {
    refreshing = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken: tokens.refresh })
      .then((res) => {
        const { accessToken, refreshToken } = res.data.data;
        tokens.set(accessToken, refreshToken);
        return accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url = original?.url || '';
    const skip = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (error.response?.status === 401 && original && !original._retry && !skip && tokens.refresh) {
      original._retry = true;
      try {
        const newAccess = await refreshTokens();
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        tokens.clear();
        window.dispatchEvent(new Event('pj-auth-expired'));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);