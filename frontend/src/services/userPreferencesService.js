import { userPreferencesAPI } from "./api";

const USER_PREFS_TTL_MS = 5 * 60 * 1000;
const CACHE_PREFIX = "dagger_user_preferences_v1_";
const memoryCache = new Map();

function getCacheKey(uid = "unknown") {
  return `${CACHE_PREFIX}${uid}`;
}

function readCache(uid) {
  const key = getCacheKey(uid);
  const mem = memoryCache.get(key);
  const now = Date.now();
  if (mem && mem.expiresAt > now) return mem.data;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt <= now) return null;
    memoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(uid, data) {
  const key = getCacheKey(uid);
  const payload = {
    data,
    expiresAt: Date.now() + USER_PREFS_TTL_MS,
  };
  memoryCache.set(key, payload);
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // noop
  }
}

export function invalidateUserPreferencesCache(uid = null) {
  if (uid) {
    const key = getCacheKey(uid);
    memoryCache.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // noop
    }
    return;
  }

  Array.from(memoryCache.keys()).forEach((key) => memoryCache.delete(key));
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // noop
  }
}

export async function fetchUserPreferences(uid, options = {}) {
  const { forceRefresh = false } = options;

  if (!uid) {
    return { favoriteTaskIds: [], hasCustomFavorites: false, source: "server-default" };
  }

  if (!forceRefresh) {
    const cached = readCache(uid);
    if (cached) return cached;
  }

  try {
    const { data } = await userPreferencesAPI.get();
    const normalized = {
      favoriteTaskIds: Array.isArray(data?.favoriteTaskIds) ? data.favoriteTaskIds : [],
      hasCustomFavorites: !!data?.hasCustomFavorites,
      source: data?.source || "server-default",
      updatedAt: data?.updatedAt,
    };
    writeCache(uid, normalized);
    return normalized;
  } catch {
    return { favoriteTaskIds: [], hasCustomFavorites: false, source: "server-default" };
  }
}

export async function saveUserFavorites(uid, favoriteTaskIds = []) {
  const uniqueIds = [];
  const seen = new Set();
  (Array.isArray(favoriteTaskIds) ? favoriteTaskIds : []).forEach((item) => {
    const id = String(item || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    uniqueIds.push(id);
  });

  const { data } = await userPreferencesAPI.update({ favoriteTaskIds: uniqueIds });
  const normalized = {
    favoriteTaskIds: Array.isArray(data?.favoriteTaskIds) ? data.favoriteTaskIds : uniqueIds,
    hasCustomFavorites: true,
    source: "user-preferences",
    updatedAt: data?.updatedAt,
  };
  if (uid) writeCache(uid, normalized);
  return normalized;
}

