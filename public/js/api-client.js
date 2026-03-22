/**
 * api-client.js
 * Thin fetch wrapper — auto-handles 401 redirects and JSON parsing.
 */

const api = (() => {
  const BASE = '';

  async function request(method, url, data) {
    const opts = {
      method,
      credentials: 'include',
      headers: {}
    };
    if (data !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }

    let res;
    try {
      res = await fetch(BASE + url, opts);
    } catch (err) {
      throw new Error('Lỗi kết nối mạng: ' + err.message);
    }

    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text };
    }

    if (!res.ok) {
      const msg = (json && json.message) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return json;
  }

  return {
    get:    (url)        => request('GET',    url),
    post:   (url, data)  => request('POST',   url, data),
    put:    (url, data)  => request('PUT',    url, data),
    patch:  (url, data)  => request('PATCH',  url, data),
    delete: (url, data)  => request('DELETE', url, data)
  };
})();
