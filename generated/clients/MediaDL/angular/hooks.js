// Hooks React prets a l'emploi
import { useState } from 'react';
import { api } from './apiClient';

export const useBatches = (token) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const list = async () => {
    setLoading(true);
    try {
      const res = await api.batches.list(token);
      setData(res?.data || []);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const create = async (payload) => api.batches.create(payload, token);
  const get = async (id) => (api.batches.getById ? api.batches.getById(id, token) : api.batches.get(id, token));
  const update = async (id, payload) => api.batches.update(id, payload, token);
  const remove = async (id) => api.batches.remove(id, token);

  const getAll = list;

  return { data, loading, error, list, getAll, create, get, update, remove };
};

export const useBatchesById = (token, id) => {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOne = async () => {
    setLoading(true);
    try {
      const res = await (api.batches.getById ? api.batches.getById(id, token) : api.batches.get(id, token));
      setItem(res?.data || null);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { item, loading, error, fetchOne };
};

export const useCreateBatches = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = async (payload) => {
    setLoading(true);
    try {
      const res = await api.batches.create(payload, token);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { create, loading, error };
};

export const useUpdateBatches = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = async (id, payload) => {
    setLoading(true);
    try {
      const res = await api.batches.update(id, payload, token);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
};

export const useDeleteBatches = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const remove = async (id) => {
    setLoading(true);
    try {
      const res = await api.batches.remove(id, token);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { remove, loading, error };
};

export const useDownloads = (token) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const list = async () => {
    setLoading(true);
    try {
      const res = await api.downloads.list(token);
      setData(res?.data || []);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const create = async (payload) => api.downloads.create(payload, token);
  const get = async (id) => (api.downloads.getById ? api.downloads.getById(id, token) : api.downloads.get(id, token));
  const update = async (id, payload) => api.downloads.update(id, payload, token);
  const remove = async (id) => api.downloads.remove(id, token);

  const getAll = list;

  return { data, loading, error, list, getAll, create, get, update, remove };
};

export const useDownloadsById = (token, id) => {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOne = async () => {
    setLoading(true);
    try {
      const res = await (api.downloads.getById ? api.downloads.getById(id, token) : api.downloads.get(id, token));
      setItem(res?.data || null);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { item, loading, error, fetchOne };
};

export const useCreateDownloads = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = async (payload) => {
    setLoading(true);
    try {
      const res = await api.downloads.create(payload, token);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { create, loading, error };
};

export const useUpdateDownloads = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = async (id, payload) => {
    setLoading(true);
    try {
      const res = await api.downloads.update(id, payload, token);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
};

export const useDeleteDownloads = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const remove = async (id) => {
    setLoading(true);
    try {
      const res = await api.downloads.remove(id, token);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { remove, loading, error };
};

export const usePresets = (token) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const list = async () => {
    setLoading(true);
    try {
      const res = await api.presets.list(token);
      setData(res?.data || []);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const create = async (payload) => api.presets.create(payload, token);
  const get = async (id) => (api.presets.getById ? api.presets.getById(id, token) : api.presets.get(id, token));
  const update = async (id, payload) => api.presets.update(id, payload, token);
  const remove = async (id) => api.presets.remove(id, token);

  const getAll = list;

  return { data, loading, error, list, getAll, create, get, update, remove };
};

export const usePresetsById = (token, id) => {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOne = async () => {
    setLoading(true);
    try {
      const res = await (api.presets.getById ? api.presets.getById(id, token) : api.presets.get(id, token));
      setItem(res?.data || null);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { item, loading, error, fetchOne };
};

export const useCreatePresets = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = async (payload) => {
    setLoading(true);
    try {
      const res = await api.presets.create(payload, token);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { create, loading, error };
};

export const useUpdatePresets = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = async (id, payload) => {
    setLoading(true);
    try {
      const res = await api.presets.update(id, payload, token);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
};

export const useDeletePresets = (token) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const remove = async (id) => {
    setLoading(true);
    try {
      const res = await api.presets.remove(id, token);
      setError(null);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { remove, loading, error };
};
