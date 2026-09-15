import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { asArray } from '../utils/helpers';

const CategoriesContext = createContext(null);

/** Build parent → children trees from a flat category list. */
export function buildCategoryTree(categories = []) {
  const list = asArray(categories);
  const childrenByParent = new Map();
  for (const c of list) {
    if (!c.parentId) continue;
    if (!childrenByParent.has(c.parentId)) childrenByParent.set(c.parentId, []);
    childrenByParent.get(c.parentId).push(c);
  }
  for (const kids of childrenByParent.values()) {
    kids.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }
  return list
    .filter((c) => !c.parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map((c) => ({
      ...c,
      children: childrenByParent.get(c.id) || [],
    }));
}

export function CategoriesProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = () =>
    api
      .get('/categories')
      .then((r) => setCategories(asArray(r.data)))
      .catch(() => setCategories([]));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/categories')
      .then((r) => {
        if (!cancelled) setCategories(asArray(r.data));
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const treeByAudience = useMemo(() => {
    const map = { men: [], women: [], kids: [] };
    for (const node of tree) {
      if (map[node.audience]) map[node.audience].push(node);
    }
    return map;
  }, [tree]);

  const value = useMemo(
    () => ({ categories, tree, treeByAudience, loading, refresh }),
    [categories, tree, treeByAudience, loading]
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export const useCategories = () => useContext(CategoriesContext);
