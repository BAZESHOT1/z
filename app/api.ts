export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://132.243.235.23:4000';

export async function fetchPosts() {
  try {
    const response = await fetch(`${API_URL}/api/posts`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.warn('Не удалось загрузить с бэкенда, используем локальный режим:', error);
    return null;
  }
}

export async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    return await response.json();
  } catch (error) {
    return { status: 'error', message: 'VPS недоступен' };
  }
}