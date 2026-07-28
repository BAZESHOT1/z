export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://82.26.152.225:4000';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request(path: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...options.headers
  };

  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    
    if (res.status === 401) {
      authToken = null; // Сброс при неверном токене
      return null;
    }
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Request failed');
    }
    
    return await res.json();
  } catch (e: any) {
    console.error(`API Error [${path}]:`, e.message);
    // Если произошел сброс соединения, возвращаем пустую структуру или выбрасываем понятную ошибку
    if (e.message.includes('fetch')) throw new Error('Сервер временно недоступен');
    throw e;
  }
}

export const fetchCurrentUser = () => request('/api/auth/me');
export const loginUser = (data: any) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const registerUser = (data: any) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const checkUsername = (username: string) => request(`/api/auth/check-username?username=${encodeURIComponent(username)}`);

export const fetchPosts = (username?: string) => 
  request(`/api/posts${username ? `?username=${username}` : ''}`).then(res => res || []);

export const createPost = (content: string) => 
  request('/api/posts', { method: 'POST', body: JSON.stringify({ content }) });

export const toggleLike = (postId: number) => 
  request(`/api/posts/${postId}/like`, { method: 'POST' });

export const fetchUserProfile = (username: string) => request(`/api/users/${username}`);