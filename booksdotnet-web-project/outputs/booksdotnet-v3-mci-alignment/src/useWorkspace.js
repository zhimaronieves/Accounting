import { withBankingSamples } from './versions/v3-banking-samples.js';
import v3Seed from './v3-initial-snapshot.json';
import { upgradeBanking as upgradeWorkspace, reduceBanking as reduceV2 } from './versions/v2/banking.js';
import { useEffect, useRef, useState } from 'react';
import { assertWorkspace, createWorkspace, withOwnerCapitalSamples, STORAGE_KEY } from './accounting.js';

export function useWorkspace() {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY), base = upgradeWorkspace(raw ? withOwnerCapitalSamples(assertWorkspace(JSON.parse(raw))) : v3Seed.workspace ? withOwnerCapitalSamples(assertWorkspace(structuredClone(v3Seed.workspace))) : createWorkspace());
      try { const data=withBankingSamples(base); return {data,seeded:data!==base,problem:''}; }
      catch (error) { return {data:base,problem:'Banking samples could not be loaded. Existing records are retained: '+error.message}; }
    }
    catch { return { data: upgradeWorkspace(createWorkspace()), problem: 'Saved data could not be loaded. Your saved copy has not been overwritten. Changes in this session will not be saved.' }; }
  });
  const [workspace, setWorkspace] = useState(initial.data);
  const current = useRef(initial.data);
  const [storageProblem, setStorageProblem] = useState(initial.problem);
  useEffect(() => { if (initial.seeded && !initial.problem) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(initial.data)); } catch { setStorageProblem('Banking samples are available for this session only because browser storage is unavailable.'); } } }, [initial]);
  function commit(action) {
    try {
      const next = reduceV2(current.current, action);
      if (!initial.problem) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { setStorageProblem('Browser storage is unavailable or full. Changes are kept only for this session.'); } }
      current.current = next; setWorkspace(next); return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  return { workspace, commit, storageProblem };
}

