import { upgradeBanking as upgradeWorkspace, reduceBanking as reduceV2 } from './versions/v2/banking.js';
import { useRef, useState } from 'react';
import { assertWorkspace, createWorkspace, withOwnerCapitalSamples, STORAGE_KEY } from './accounting.js';

export function useWorkspace() {
  const [initial] = useState(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); return { data: upgradeWorkspace(raw ? withOwnerCapitalSamples(assertWorkspace(JSON.parse(raw))) : createWorkspace()), problem: '' }; }
    catch { return { data: upgradeWorkspace(createWorkspace()), problem: 'Saved data could not be loaded. Your saved copy has not been overwritten. Changes in this session will not be saved.' }; }
  });
  const [workspace, setWorkspace] = useState(initial.data);
  const current = useRef(initial.data);
  const [storageProblem, setStorageProblem] = useState(initial.problem);
  function commit(action) {
    try {
      const next = reduceV2(current.current, action);
      if (!initial.problem) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { setStorageProblem('Browser storage is unavailable or full. Changes are kept only for this session.'); } }
      current.current = next; setWorkspace(next); return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  return { workspace, commit, storageProblem };
}

