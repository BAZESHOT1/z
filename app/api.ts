export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://132.243.235.23:4000';

export async function fetchPosts() {
  const response = await fetch(`${API_URL}/api/posts`);
  if (!response.ok) throw new Error('Ошибка сервера при загрузке постов');
  return await response.json();
}

export async function createPost(content: string, imageUrl?: string) {
  const response = await fetch(`${API_URL}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, imageUrl }),
  });
  if (!response.ok) throw new Error('Не удалось создать пост');
  return await response.json();
}

export async function togglePostLike(postId: string) {
  const response = await fetch(`${API_URL}/api/posts/${postId}/like`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Ошибка при лайке');
  return await response.json();
}

export async function fetchClusterNodes() {
  const response = await fetch(`${API_URL}/api/cluster/nodes`);
  if (!response.ok) throw new Error('Ошибка загрузки нод');
  return await response.json();
}