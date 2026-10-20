'use client';

import { useState } from 'react';
import { Badge, Button, Modal, toast } from '@/components/ui';
import { hasDrawing, type ShotWithStoryboard } from './engine';
import { StoryboardThumb } from './StoryboardThumb';
import {
  getVersions, planDelete, planRestore, planSnapshot, saveShotStoryboard,
  type ShotStoryboardPatch, type StoryboardVersion,
} from '@/lib/storyboard-print/versions';

interface Props {
  shot: ShotWithStoryboard | null;
  onClose: () => void;
  userId: string | null;
  canEdit: boolean;
  onShotPatched: (shotId: string, patch: Partial<ShotWithStoryboard>) => void;
}

const SOURCE_LABEL: Record<StoryboardVersion['source'], string> = { scan: 'Scan', drawn: 'Drawn', restore: 'Restored' };

export function StoryboardVersionsDialog({ shot, onClose, userId, canEdit, onShotPatched }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!shot) return null;
  const versions = [...getVersions(shot)].reverse();
  const current = JSON.stringify(shot.storyboard_drawing);

  const run = async (key: string, patch: ShotStoryboardPatch | null, done: string) => {
    if (!patch) return;
    setBusy(key);
    try {
      await saveShotStoryboard(shot.id, patch);
      onShotPatched(shot.id, patch as Partial<ShotWithStoryboard>);
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Shot ${shot.shot_number || ''} — frame versions`} size="lg">
      <div className="space-y-4">
        <div className="flex gap-4 items-start">
          <div className="w-48 shrink-0 rounded-lg overflow-hidden border border-surface-700">
            <StoryboardThumb drawing={shot.storyboard_drawing} imageUrl={shot.storyboard_url} emptyLabel="No frame" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-white font-medium">Current frame</p>
            <p className="text-xs text-surface-400">
              What the storyboard shows. Scans and restores keep the frame they replace, so nothing is lost.
            </p>
            {canEdit && hasDrawing(shot.storyboard_drawing) && (
              <Button size="sm" variant="secondary" loading={busy === 'snap'}
                onClick={() => run('snap', planSnapshot(shot, `Snapshot ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`, userId), 'Saved as a version.')}>
                Save current as version
              </Button>
            )}
          </div>
        </div>

        {versions.length === 0 ? (
          <p className="text-sm text-surface-500 py-6 text-center">No earlier versions yet. Scanning a drawn page adds one.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 max-h-[50vh] overflow-y-auto pr-1">
            {versions.map((v) => {
              const isCurrent = JSON.stringify(v.drawing) === current;
              return (
                <div key={v.id} className="rounded-lg border border-surface-800 overflow-hidden">
                  <StoryboardThumb drawing={v.drawing} emptyLabel="Empty" />
                  <div className="p-2 bg-surface-950 space-y-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge size="sm" variant={v.source === 'scan' ? 'info' : 'default'}>{SOURCE_LABEL[v.source] || v.source}</Badge>
                      {isCurrent && <Badge size="sm" variant="success">Current</Badge>}
                      <span className="text-xs text-surface-300 truncate">{v.label}</span>
                    </div>
                    <p className="text-[11px] text-surface-500">{new Date(v.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" disabled={isCurrent} loading={busy === `r-${v.id}`}
                          onClick={() => run(`r-${v.id}`, planRestore(shot, v.id, userId), 'Version is now the current frame.')}>
                          Make current
                        </Button>
                        <Button size="sm" variant="ghost" loading={busy === `d-${v.id}`}
                          onClick={() => { if (window.confirm('Delete this version?')) run(`d-${v.id}`, planDelete(shot, v.id), 'Version deleted.'); }}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
