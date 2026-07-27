export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://82.26.152.225:4000';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function getHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

export async function registerUser(data: any) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Ошибка регистрации');
  return json;
}

export async function loginUser(data: any) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Ошибка входа');
  return json;
}

export async function fetchCurrentUser() {
  if (!authToken) return null;
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: getHeaders(),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function updateUserRole(role: string) {
  const res = await fetch(`${API_URL}/api/auth/role`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ role }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Ошибка смены роли');
  return json;
}

export async function fetchPosts() {
  const response = await fetch(`${API_URL}/api/posts`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Ошибка сервера при загрузке постов');
  return await response.json();
}

export async function createPost(content: string, imageUrl?: string) {
  const response = await fetch(`${API_URL}/api/posts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content, imageUrl }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Не удалось создать пост');
  return json;
}

export async function togglePostLike(postId: string) {
  const response = await fetch(`${API_URL}/api/posts/${postId}/like`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Ошибка при лайке');
  return await response.json();
}

export async function fetchClusterNodes() {
  const response = await fetch(`${API_URL}/api/cluster/nodes`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Ошибка загрузки нод');
  return await response.json();
}