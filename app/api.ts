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

export async function fetchCurrentUser() {
  if (!authToken) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: getHeaders() });
    if (res.status === 401) {
      setAuthToken(null);
      return null;
    }
    return res.ok ? await res.json() : null;
  } catch (e) { return null; }
}

export async function loginUser(data: any) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Auth failed');
  return json;
}

export async function fetchPosts(username?: string) {
  const url = username ? `${API_URL}/api/posts?username=${username}` : `${API_URL}/api/posts`;
  try {
    const res = await fetch(url, { headers: getHeaders() });
    return await res.json();
  } catch (e) { return []; }
}

export async function createPost(content: string) {
  const res = await fetch(`${API_URL}/api/posts`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });
  return await res.json();
}

export async function toggleLike(postId: number) {
  const res = await fetch(`${API_URL}/api/posts/${postId}/like`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return await res.json();
}

export async function checkUsername(username: string) {
  const res = await fetch(`${API_URL}/api/auth/check-username?username=${encodeURIComponent(username)}`);
  return await res.json();
}

export async function registerUser(data: any) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return await res.json();
}

export async function fetchUserProfile(username: string) {
  const res = await fetch(`${API_URL}/api/users/${username}`, { headers: getHeaders() });
  return res.ok ? await res.json() : null;
}