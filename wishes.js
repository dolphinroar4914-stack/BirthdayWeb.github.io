(function () {
  const config = window.WISH_CONFIG || {};

  function getBaseUrl() {
    return String(config.supabaseUrl || "").trim().replace(/\/+$/, "");
  }

  function getAnonKey() {
    return String(config.supabaseAnonKey || "").trim();
  }

  function isConfigured() {
    return Boolean(getBaseUrl() && getAnonKey());
  }

  function getLocalWishes() {
    try {
      const saved = JSON.parse(localStorage.getItem("birthday_wishes_local_v1") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function saveLocalWish(wish) {
    const saved = getLocalWishes();
    saved.push(wish);
    localStorage.setItem("birthday_wishes_local_v1", JSON.stringify(saved));

    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("birthday-wishes");
      channel.postMessage({ type: "wish-added", wish });
      channel.close();
    }
  }

  async function request(path, options) {
    if (!isConfigured()) {
      throw new Error("Supabase is not configured. Add the project URL and anon key to wish-config.js.");
    }

    const response = await fetch(`${getBaseUrl()}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: getAnonKey(),
        Authorization: `Bearer ${getAnonKey()}`,
        "Content-Type": "application/json",
        ...(options && options.headers)
      }
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || `Request failed (${response.status}).`);
    }

    return response.status === 204 ? null : response.json();
  }

  async function fetchWishes() {
    if (!isConfigured()) return getLocalWishes();
    const rows = await request("birthday_wishes?select=id,sender,message,created_at&order=created_at.asc", {
      method: "GET"
    });
    if (!Array.isArray(rows)) throw new Error("The wish service returned an unexpected response.");
    return rows;
  }

  async function submitWish(sender, message) {
    if (!isConfigured()) {
      const wish = {
        id: `local-${Date.now()}`,
        sender,
        message,
        created_at: new Date().toISOString()
      };
      saveLocalWish(wish);
      return wish;
    }

    const rows = await request("birthday_wishes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ sender, message })
    });
    if (!Array.isArray(rows) || !rows[0]) {
      throw new Error("The wish service did not confirm the submission.");
    }
    return rows[0];
  }

  window.WishService = { isConfigured, fetchWishes, submitWish };
})();
