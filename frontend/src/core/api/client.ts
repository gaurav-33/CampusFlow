import axios from 'axios';
import { getToken } from '../utils/storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ks1qk7dsne.execute-api.ap-south-1.amazonaws.com/dev/api';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn('[API] Auth failed — token may have expired');
    }
    return Promise.reject(error);
  }
);

export default client;
