export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://82.26.152.225:4000';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAvatarUrl(username?: string, customAvatar?: string | null) {
  if (customAvatar && customAvatar.length > 5) return customAvatar;
  const name = encodeURIComponent(username || 'Z');
  return `https://ui-avatars.com/api/?name=${name}&background=5353ff&color=fff&size=200&font-size=0.4`;
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
      authToken = null;
      return null;
    }
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Request failed');
    }
    
    return await res.json();
  } catch (e: any) {
    console.error(`API Error [${path}]:`, e.message);
    if (e.message?.includes('fetch')) throw new Error('Сервер временно недоступен');
    throw e;
  }
}

export const fetchCurrentUser = () => request('/api/auth/me');
export const loginUser = (data: any) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const registerUser = (data: any) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const checkUsername = (username: string) => request(`/api/auth/check-username?username=${encodeURIComponent(username)}`);

// Admin & Role API
export const becomeAdmin = () => request('/api/auth/become-admin', { method: 'POST' });
export const fetchAdminUsers = () => request('/api/admin/users').then(res => res || []);
export const updateUserRole = (userId: number, role: string) => request(`/api/admin/users/${userId}/role`, { method: 'POST', body: JSON.stringify({ role }) });
export const fetchAdminStats = () => request('/api/admin/stats');

// Paginated Feed & Posts CRUD
export const fetchFeedPosts = (page: number = 1, limit: number = 10, username?: string) => 
  request(`/api/posts/feed?page=${page}&limit=${limit}${username ? `&username=${encodeURIComponent(username)}` : ''}`);

export const fetchPosts = (username?: string) => 
  request(`/api/posts${username ? `?username=${encodeURIComponent(username)}` : ''}`).then(res => res || []);

export const createPost = (content: string, mediaUrl?: string) => 
  request('/api/posts', { method: 'POST', body: JSON.stringify({ content, mediaUrl }) });

export const updatePost = (postId: number, content: string, mediaUrl?: string) => 
  request(`/api/posts/${postId}`, { method: 'PUT', body: JSON.stringify({ content, mediaUrl }) });

export const deletePost = (postId: number) => 
  request(`/api/posts/${postId}`, { method: 'DELETE' });

export const recordPostView = (postId: number) => 
  request(`/api/posts/${postId}/view`, { method: 'POST' });

export const toggleLike = (postId: number) => 
  request(`/api/posts/${postId}/like`, { method: 'POST' });

export const fetchComments = (postId: number) => 
  request(`/api/posts/${postId}/comments`).then(res => res || []);

export const createComment = (postId: number, content: string) => 
  request(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });

export const fetchUserProfile = (username: string) => request(`/api/users/${encodeURIComponent(username)}`);

export const updateProfile = (data: any) => 
  request('/api/users/update', { method: 'POST', body: JSON.stringify(data) });

export const toggleFollow = (usernameOrId: string) => 
  request(`/api/users/${encodeURIComponent(usernameOrId)}/follow`, { method: 'POST' });

export const fetchFollowers = (username: string) => 
  request(`/api/users/${encodeURIComponent(username)}/followers`).then(res => res || []);

export const fetchFollowing = (username: string) => 
  request(`/api/users/${encodeURIComponent(username)}/following`).then(res => res || []);

// Telegram-style Mini Apps API
export const fetchMiniApps = () => request('/api/apps').then(res => res || []);
export const createMiniApp = (data: { title: string, description: string, url: string, icon?: string }) => 
  request('/api/apps', { method: 'POST', body: JSON.stringify(data) });

export const uploadMedia = (base64Data: string) => 
  request('/api/upload', { method: 'POST', body: JSON.stringify({ file: base64Data }) });