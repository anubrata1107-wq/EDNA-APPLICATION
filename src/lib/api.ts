import { auth } from './firebase';

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  adminToken?: string | null
): Promise<T> {
  const currentUser = auth.currentUser;
  const headers = new Headers(options.headers || {});

  if (currentUser) {
    const idToken = await currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${idToken}`);
  }

  if (adminToken) {
    headers.set('X-Admin-Token', adminToken);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) errMsg = json.error;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errMsg);
  }

  return (await res.json()) as T;
}

export async function downloadAuthenticatedFile(url: string, filename: string) {
  const currentUser = auth.currentUser;
  const headers = new Headers();
  if (currentUser) {
    const idToken = await currentUser.getIdToken();
    headers.set('Authorization', `Bearer ${idToken}`);
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error('Failed to download file.');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
