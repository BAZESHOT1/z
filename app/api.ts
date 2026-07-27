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
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Connection failed');
  return json;
}

export async function loginUser(data: any) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Authentication error');
  return json;
}

export async function fetchCurrentUser() {
  if (!authToken) return null;
  const res = await fetch(`${API_URL}/api/auth/me`, { headers: getHeaders() });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchUserProfile(username: string) {
  const res = await fetch(`${API_URL}/api/users/${username}`, { headers: getHeaders() });
  if (!res.ok) return null;
  return await res.json();
}

export async function updateProfile(data: any) {
  const res = await fetch(`${API_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return await res.json();
}

export async function fetchPosts(username?: string) {
  const url = username ? `${API_URL}/api/posts?username=${username}` : `${API_URL}/api/posts`;
  const res = await fetch(url, { headers: getHeaders() });
  return await res.json();
}

export async function toggleFollow(userId: string) {
  const res = await fetch(`${API_URL}/api/users/${userId}/follow`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return await res.json();
}