"use client";

import { useCallback, useEffect, useState } from "react";

interface ModelsCache {
  [cli: string]: { models: string[]; timestamp: number };
}

const CACHE_KEY = "cli-models-cache";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function readCache(cli: string): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModelsCache;
    const entry = parsed[cli];
    if (!entry || typeof entry.timestamp !== "number") return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.models;
  } catch {
    return null;
  }
}

function writeCache(cli: string, models: string[]): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed: ModelsCache = raw ? (JSON.parse(raw) as ModelsCache) : {};
    parsed[cli] = { models, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage unavailable
  }
}

export function useModels(cli: string) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/models?cli=${encodeURIComponent(cli)}`);
      const data = (await r.json()) as { models: string[] };
      setModels(data.models);
      writeCache(cli, data.models);
    } catch {
      setModels(["default"]);
    } finally {
      setLoading(false);
    }
  }, [cli]);

  const refreshModels = useCallback(() => {
    void fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    const cached = readCache(cli);
    if (cached) {
      setModels(cached);
      setLoading(false);
    } else {
      void fetchModels();
    }
  }, [cli, fetchModels]);

  return { models, loading, refreshModels };
}
