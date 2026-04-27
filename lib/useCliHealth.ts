"use client";

import { useCallback, useEffect, useState } from "react";

export interface CliStatus {
  installed: boolean;
  version: string | null;
  ready: boolean;
  authInfo: string | null;
}

export interface HealthStatus {
  claude: CliStatus;
  kilo: CliStatus;
  gemini: CliStatus;
}

interface HealthCache {
  data: HealthStatus;
  timestamp: number;
}

const CACHE_KEY = "cli-health-cache";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function readCache(): HealthCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HealthCache;
    if (!parsed.data || typeof parsed.timestamp !== "number") return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: HealthStatus): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage unavailable (private browsing, full storage)
  }
}

export function useCliHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/health");
      const h = (await r.json()) as HealthStatus;
      setHealth(h);
      writeCache(h);
    } catch {
      const empty: CliStatus = { installed: false, version: null, ready: false, authInfo: null };
      setHealth({ claude: empty, kilo: empty, gemini: empty });
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHealth = useCallback(() => {
    void fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setHealth(cached.data);
      setLoading(false);
    } else {
      void fetchHealth();
    }
  }, [fetchHealth]);

  return { health, loading, refreshHealth };
}
