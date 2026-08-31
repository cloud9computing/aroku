import React, { useMemo, useState } from 'react';
import { DocumentRecord } from '../../types';
import { computeFactNameClusters, applyFactNameRename } from '../../utils/factNameClusters';
import { IconCheck, IconTags, IconX, IconArrowsSplit } from '@tabler/icons-react';

interface StandardizeNamesModalProps {
  isOpen: boolean;
  records: DocumentRecord[];
  onUpdateRecord: (record: DocumentRecord) => void;
  onClose: () => void;
}

export const StandardizeNamesModal: React.FC<StandardizeNamesModalProps> = ({
  isOpen,
  records,
  onUpdateRecord,
  onClose,
}) => {
  const clusters = useMemo(() => computeFactNameClusters(records), [records]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mergedKeys, setMergedKeys] = useState<Set<string>>(new Set());
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleMerge = (clusterKey: string) => {
    const canonicalName = (drafts[clusterKey] ?? clusters.find((c) => c.key === clusterKey)?.suggestedName ?? '').trim();
    if (!canonicalName) return;
    const changed = applyFactNameRename(records, clusterKey, canonicalName);
    changed.forEach(onUpdateRecord);
    setMergedKeys((prev) => new Set(prev).add(clusterKey));
  };

  const handleKeepSeparate = (clusterKey: string) => {
    setDismissedKeys((prev) => new Set(prev).add(clusterKey));
  };

  const pendingClusters = clusters.filter((c) => !mergedKeys.has(c.key) && !dismissedKeys.has(c.key));

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[88dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-lavender-light text-lavender flex items-center justify-center">
              <IconTags size={16} />
            </div>
            <div>
              <h3 className="font-serif text-lg text-ink-800 leading-tight">Standardize Names</h3>
              <p className="text-[10px] text-ink-400">Only renames — values & verification untouched</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <div className="py-3 space-y-3 text-xs overflow-y-auto pr-0.5 flex-1">
          {clusters.length === 0 ? (
            <p className="text-center py-10 text-ink-400">
              No inconsistent names found — every repeated test is already using one name.
            </p>
          ) : pendingClusters.length === 0 ? (
            <p className="text-center py-10 text-sage flex flex-col items-center gap-2">
              <IconCheck size={20} /> All done.
            </p>
          ) : (
            pendingClusters.map((cluster) => (
              <div key={cluster.key} className="bg-white border border-paper-300 rounded-xl p-3 space-y-2">
                <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold">
                  {cluster.totalCount} readings, {cluster.variants.length} different names
                </p>
                <div className="space-y-1">
                  {cluster.variants.map((v) => (
                    <p key={v.name} className="text-[11px] text-ink-700">
                      &ldquo;{v.name}&rdquo; <span className="text-ink-400">× {v.count}</span>
                    </p>
                  ))}
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">
                    Rename all to
                  </label>
                  <input
                    type="text"
                    value={drafts[cluster.key] ?? cluster.suggestedName}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [cluster.key]: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-paper-50 border border-paper-300 rounded-lg text-xs text-ink-800 focus:outline-none focus:border-terracotta"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMerge(cluster.key)}
                    className="flex-1 py-2 bg-terracotta-light text-terracotta rounded-lg text-xs font-medium hover:opacity-90 transition-all"
                  >
                    Merge into one name
                  </button>
                  <button
                    onClick={() => handleKeepSeparate(cluster.key)}
                    className="px-3 py-2 border border-paper-400 text-ink-400 hover:text-ink-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                    title="These are actually different things — don't merge them"
                  >
                    <IconArrowsSplit size={13} /> Keep separate
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-2.5 border-t border-paper-300 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 bg-paper-300 hover:bg-paper-400 text-ink-700 text-xs font-medium rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
