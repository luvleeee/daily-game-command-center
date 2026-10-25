import { useRef, useState } from 'react';
import {
  ArchiveRestore,
  BadgeCheck,
  Download,
  FileSpreadsheet,
  ListOrdered,
  Moon,
  PartyPopper,
  Rows3,
  Share,
  Share2,
  Smartphone,
  Trash2,
  Trophy,
  Undo2,
  Upload,
  Vibrate,
  Volume2,
} from 'lucide-react';
import Sheet from '../ui/Sheet';
import GameIcon from '../GameIcon';
import { Button, ConfirmButton, Toggle } from '../ui/primitives';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { formatDayKey, toDayKey } from '../../lib/dates';
import { toast } from '../../lib/events';
import { buildCsv } from '../../lib/csv';

export default function SettingsModal({ open, onClose, state, archivedGames, restToday, onToggleRestDay, actions, onDeleteGame }) {
  const fileRef = useRef(null);
  const [message, setMessage] = useState('');
  const { canPrompt, promptInstall, installed, isIOS } = useInstallPrompt();
  const s = state.settings;
  const set = (patch) => actions.updateSettings(patch);

  const backupFile = () => {
    const json = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
    return new File([json], `game-command-center-${toDayKey()}.json`, { type: 'application/json' });
  };

  const exportCsv = async () => {
    const file = new File([buildCsv(state)], `game-results-${toDayKey()}.csv`, { type: 'text/csv' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Game results' });
        return;
      }
    } catch {
      return; // share sheet cancelled
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const exportData = () => {
    const file = backupFile();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    set({ lastBackupAt: new Date().toISOString() });
    setMessage('Backup downloaded.');
  };

  const canShareFiles = (() => {
    try {
      return Boolean(navigator.canShare?.({ files: [backupFile()] }));
    } catch {
      return false;
    }
  })();

  const shareData = async () => {
    try {
      await navigator.share({ files: [backupFile()], title: 'Game Command Center backup' });
      set({ lastBackupAt: new Date().toISOString() });
      setMessage('Backup shared.');
    } catch {
      /* user cancelled */
    }
  };

  const importData = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const snapshot = actions.snapshot();
      const ok = actions.importState(JSON.parse(await file.text()));
      if (ok) toast({ message: 'Backup restored', action: 'Undo', icon: Upload, onAction: () => actions.restore(snapshot) });
      setMessage(ok ? 'Backup restored.' : 'That file isn’t a valid backup.');
    } catch {
      setMessage('Couldn’t read that file.');
    }
  };

  const toggleBadge = async (on) => {
    if (on && 'Notification' in window && Notification.permission === 'default') {
      // iOS requires notification permission before the icon badge shows
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
    set({ appBadge: on });
  };

  const badgeSupported = 'setAppBadge' in navigator;

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="space-y-6 pt-1">
        <Group title="Today">
          <Toggle checked={restToday} onChange={onToggleRestDay} icon={Moon} label="Rest day" hint="Pause every streak for today — handy when travelling or sick" />
        </Group>

        <Group title="Dashboard">
          <Toggle checked={s.density === 'compact'} onChange={(v) => set({ density: v ? 'compact' : 'comfortable' })} icon={Rows3} label="Compact cards" hint="Fit more games on screen" />
          <Toggle checked={s.sortTodoFirst} onChange={(v) => set({ sortTodoFirst: v })} icon={ListOrdered} label="Unplayed games first" hint="At-risk streaks float to the top of each category" />
          <Toggle checked={s.showResultsOnCards} onChange={(v) => set({ showResultsOnCards: v })} icon={Trophy} label="Show today’s score on cards" />
        </Group>

        <Group title="Feedback">
          <Toggle checked={s.returnPrompt} onChange={(v) => set({ returnPrompt: v })} icon={Undo2} label="“Done with it?” prompt" hint="When you come back from a game, offer to mark it done / log the score" />
          <Toggle checked={s.haptics} onChange={(v) => set({ haptics: v })} icon={Vibrate} label="Haptics" hint="Vibration on supported phones (Android)" />
          <Toggle checked={s.sounds} onChange={(v) => set({ sounds: v })} icon={Volume2} label="Sounds" hint="Subtle clicks and chimes" />
          <Toggle checked={s.confetti} onChange={(v) => set({ confetti: v })} icon={PartyPopper} label="Confetti" hint="When you finish every game, or beat a personal best" />
          {badgeSupported && (
            <Toggle checked={s.appBadge} onChange={toggleBadge} icon={BadgeCheck} label="App icon badge" hint="Show games left today on the home-screen icon (installed app)" />
          )}
        </Group>

        <Group title="Install on your phone">
          {installed ? (
            <p className="text-sm text-emerald-300/90">Installed — you’re running the app version.</p>
          ) : canPrompt ? (
            <Button className="w-full" onClick={promptInstall}>
              <Smartphone size={18} /> Install app
            </Button>
          ) : isIOS ? (
            <p className="text-sm leading-relaxed text-white/60">
              In Safari, tap <Share size={14} className="mx-0.5 inline -translate-y-0.5" /> <b>Share</b> → <b>Add to Home Screen</b>.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-white/60">
              Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.
            </p>
          )}
        </Group>

        <Group
          title="Backup"
          hint={`Data lives only on this device. ${s.lastBackupAt ? `Last backup: ${formatDayKey(toDayKey(new Date(s.lastBackupAt)))}.` : 'No backup yet.'}`}
        >
          <div className="grid grid-cols-2 gap-2">
            {canShareFiles ? (
              <Button variant="secondary" onClick={shareData}>
                <Share2 size={17} /> Share
              </Button>
            ) : (
              <Button variant="secondary" onClick={exportData}>
                <Download size={17} /> Export
              </Button>
            )}
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={17} /> Import
            </Button>
          </div>
          {canShareFiles && (
            <button onClick={exportData} className="mt-2 text-xs font-medium text-violet-300/80">
              Download the file instead
            </button>
          )}
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importData} />
          <Button variant="secondary" className="mt-2 w-full" onClick={exportCsv}>
            <FileSpreadsheet size={17} /> Export results as CSV
          </Button>
          <p className="mt-1 text-[11px] text-white/35">One row per day, game and stat — opens in Excel, Numbers or Google Sheets.</p>
          {message && <p className="mt-2 text-xs text-violet-200/80">{message}</p>}
        </Group>

        {archivedGames.length > 0 && (
          <Group title={`Archived games (${archivedGames.length})`} hint="Hidden from the dashboard; stats are kept.">
            <div className="divide-y divide-white/5 rounded-2xl border border-white/8 bg-white/4">
              {archivedGames.map((g) => (
                <div key={g.id} className="flex items-center gap-3 px-3 py-2">
                  <GameIcon name={g.name} url={g.url} iconUrl={g.iconUrl} color={g.color} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm text-white/80">{g.name}</span>
                  <button onClick={() => actions.setArchived(g.id, false)} className="grid h-9 w-9 place-items-center rounded-lg text-emerald-300 hover:bg-white/8" aria-label={`Restore ${g.name}`}>
                    <ArchiveRestore size={16} />
                  </button>
                  <button onClick={() => onDeleteGame(g.id)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-300/80 hover:bg-white/8" aria-label={`Delete ${g.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Group>
        )}

        <Group title="Danger zone">
          <ConfirmButton
            className="w-full"
            confirmLabel="Tap again to erase everything"
            onConfirm={() => {
              const snapshot = actions.snapshot();
              actions.resetAll();
              setMessage('');
              onClose();
              toast({ message: 'Everything was reset', action: 'Undo', onAction: () => actions.restore(snapshot), duration: 8000 });
            }}
          >
            Reset all games & stats
          </ConfirmButton>
        </Group>

        <p className="text-center text-[11px] text-white/25">
          Game Command Center · works offline
          <br />
          Shortcuts: N add · R roulette · O organize · / search
        </p>
      </div>
    </Sheet>
  );
}

function Group({ title, hint, children }) {
  return (
    <section>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/45">{title}</p>
      {hint && <p className="mb-2 text-xs text-white/35">{hint}</p>}
      {children}
    </section>
  );
}
