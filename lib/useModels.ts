"use client";

import { useCallback, useEffect, useState } from "react";

interface ModelsCacheEntry {
  models: string[];
  defaultModel: string;
  timestamp: number;
}

interface ModelsCache {
  [cli: string]: ModelsCacheEntry;
}

const CACHE_KEY = "cli-models-cache-v2";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function readCache(cli: string): { models: string[]; defaultModel: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModelsCache;
    const entry = parsed[cli];
    if (!entry || typeof entry.timestamp !== "number") return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return { models: entry.models, defaultModel: entry.defaultModel };
  } catch {
    return null;
  }
}

function writeCache(cli: string, models: string[], defaultModel: string): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed: ModelsCache = raw ? (JSON.parse(raw) as ModelsCache) : {};
    parsed[cli] = { models, defaultModel, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // localStorage unavailable
  }
}

export function useModels(cli: string) {
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/models?cli=${encodeURIComponent(cli)}`);
      const data = (await r.json()) as { models: string[]; defaultModel: string };
      setModels(data.models);
      setDefaultModel(data.defaultModel);
      writeCache(cli, data.models, data.defaultModel);
    } catch {
      setModels(["default"]);
      setDefaultModel("default");
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
      setModels(cached.models);
      setDefaultModel(cached.defaultModel);
      setLoading(false);
    } else {
      void fetchModels();
    }
  }, [cli, fetchModels]);

  return { models, defaultModel, loading, refreshModels };
}
