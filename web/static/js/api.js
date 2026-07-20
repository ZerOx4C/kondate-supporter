// kondate-supporter APIを呼び出すための最小限のfetchラッパー。

async function apiRequest(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function checkHealth() {
  try {
    const data = await apiRequest('/healthz');
    return data.status === 'ok';
  } catch {
    return false;
  }
}
