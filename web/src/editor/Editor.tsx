// The editor page, for approved family members. Opened with …/bro-board/#edit.
// Nothing here is reachable from his screens.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import starter from '../data/default-board.json';
import {
  boardPhrases,
  boardWarnings,
  MAX_PHRASE_LENGTH,
  paginate,
  parseBoard,
  validateBoard,
  type Board,
  type Category,
  type Item,
} from '../board';
import { audioId } from '../remote/audioId';
import { VOICE } from '../remote/config';
import { recordingFor } from '../speech';
import * as db from './db';
import './editor.css';

const starterBoard = starter as Board;

function iconUrl(icon: string): string {
  return `${import.meta.env.BASE_URL}symbols/${icon}.svg`;
}

function linkFor(boardId: string): string {
  return `${window.location.origin}${window.location.pathname}#b=${boardId}`;
}

function wordCount(label: string): number {
  return label.trim() ? label.trim().split(/\s+/).length : 0;
}

/** A short id for a new button, made from its label. */
function makeId(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'button';
  return `${slug}-${Math.random().toString(36).slice(2, 6)}`;
}

function move<T>(list: T[], index: number, by: number): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

function formatTime(date: Date | null): string {
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'just now';
}

export default function Editor() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [signInError, setSignInError] = useState('');

  useEffect(() => {
    document.body.classList.add('editing');
    document.title = 'Bro Board editor';
    return () => document.body.classList.remove('editing');
  }, []);

  useEffect(
    () =>
      db.onUserChanged(async (u) => {
        setUser(u);
        setApproved(null);
        if (!u?.email) return;
        try {
          setApproved(await db.isApproved(u.email));
        } catch {
          setApproved(false);
        }
      }),
    [],
  );

  const signIn = async () => {
    setSignInError('');
    try {
      await db.signIn();
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setSignInError(`Sign-in did not work (${code || String(e)}). Please try again.`);
      }
    }
  };

  let body;
  if (user === undefined) {
    body = <p>Loading…</p>;
  } else if (!user) {
    body = (
      <section className="ed-card ed-center">
        <h2>Sign in to change his board</h2>
        <p>Only family members on the approved list can make changes.</p>
        <button className="ed-primary" onClick={signIn}>
          Sign in with Google
        </button>
        {signInError && <p className="ed-error">{signInError}</p>}
      </section>
    );
  } else if (approved === null) {
    body = <p>Checking your access…</p>;
  } else if (!approved) {
    body = (
      <section className="ed-card ed-center">
        <h2>This account is not on the approved list</h2>
        <p>
          You are signed in as <strong>{user.email}</strong>. Ask the family member who manages Bro Board to
          add this email, then reload this page.
        </p>
        <button onClick={() => void db.signOut()}>Sign out</button>
      </section>
    );
  } else {
    body = <Workspace />;
  }

  return (
    <div className="ed">
      <header className="ed-header">
        <h1>Bro Board editor</h1>
        {user && (
          <div className="ed-user">
            <span>{user.email}</span>
            <button onClick={() => void db.signOut()}>Sign out</button>
          </div>
        )}
      </header>
      {body}
    </div>
  );
}

type Status = { kind: 'info' | 'error' | 'ok'; text: string } | null;

function Workspace() {
  const [boardId, setBoardId] = useState<string | null | undefined>(undefined);
  const [savedJson, setSavedJson] = useState('');
  const [draft, setDraft] = useState<Board | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [voiceStatus, setVoiceStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<db.Version[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const json = draft ? JSON.stringify(draft) : '';
  const dirty = !!draft && json !== savedJson;
  const problems = draft ? validateBoard(draft) : [];
  const warnings = draft ? boardWarnings(draft) : [];

  // Make voice recordings for any phrases that do not have one yet, and remove
  // recordings no phrase uses any more. Runs after each save and on opening.
  const voiceRun = useRef<{ running: boolean; again: { id: string; board: Board } | null }>({
    running: false,
    again: null,
  });
  const syncVoices = useCallback(async (id: string, board: Board) => {
    const run = voiceRun.current;
    if (run.running) {
      run.again = { id, board };
      return;
    }
    run.running = true;
    try {
      const wanted = new Map<string, string>();
      for (const phrase of boardPhrases(board)) {
        if (!recordingFor(phrase)) wanted.set(await audioId(VOICE, phrase), phrase);
      }
      const existing = await db.listRecordingIds(id);
      for (const old of existing) if (!wanted.has(old)) await db.deleteRecording(id, old);
      const missing = [...wanted].filter(([audio]) => !existing.has(audio));
      if (missing.length === 0) {
        setVoiceStatus({ kind: 'ok', text: 'Every phrase has a natural voice recording.' });
        return;
      }
      const { makeRecording } = await import('./voice');
      for (const [i, [audio, phrase]] of missing.entries()) {
        setVoiceStatus({
          kind: 'info',
          text:
            `Making voice recording ${i + 1} of ${missing.length} (${phrase}). ` +
            (i === 0 ? 'The first one can take a minute while the voice downloads. ' : '') +
            'Please keep this page open.',
        });
        await db.saveRecording(id, audio, phrase, VOICE, await makeRecording(phrase));
      }
      setVoiceStatus({ kind: 'ok', text: 'Voice recordings are ready. His phone picks them up within a few minutes.' });
    } catch (e) {
      setVoiceStatus({
        kind: 'error',
        text:
          `Could not make the voice recordings (${String(e)}). His phone uses its own voice for new ` +
          'phrases until they are made. They are tried again each time you save or open this page.',
      });
    } finally {
      run.running = false;
      const again = run.again;
      run.again = null;
      if (again) void syncVoices(again.id, again.board);
    }
  }, []);

  const loadVersions = useCallback(async (id: string) => {
    try {
      setVersions(await db.listHistory(id));
    } catch {
      setVersions([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const boards = await db.listBoards();
        const current = boards.find((b) => parseBoard(b.json));
        if (!current) {
          setBoardId(null);
          return;
        }
        setBoardId(current.id);
        setSavedJson(current.json);
        setDraft(parseBoard(current.json));
        void loadVersions(current.id);
        void syncVoices(current.id, parseBoard(current.json)!);
      } catch (e) {
        setLoadError(String(e));
      }
    })();
  }, [loadVersions, syncVoices]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (loadError) return <p className="ed-error">Could not load his board: {loadError}</p>;
  if (boardId === undefined) return <p>Loading his board…</p>;

  if (boardId === null) {
    const create = async () => {
      setBusy(true);
      try {
        const id = db.newBoardId();
        const startJson = JSON.stringify(starterBoard);
        await db.saveBoard(id, startJson);
        setBoardId(id);
        setSavedJson(startJson);
        setDraft(starterBoard);
        void loadVersions(id);
      } catch (e) {
        setStatus({ kind: 'error', text: `Could not create the board: ${String(e)}` });
      } finally {
        setBusy(false);
      }
    };
    return (
      <section className="ed-card ed-center">
        <h2>No board yet</h2>
        <p>Create his board from the starter buttons. You get a private link to open on his phone.</p>
        <button className="ed-primary" disabled={busy} onClick={create}>
          Create his board
        </button>
        {status && <p className={`ed-${status.kind}`}>{status.text}</p>}
      </section>
    );
  }

  if (!draft) return null;

  const save = async () => {
    if (!dirty || problems.length > 0) return;
    setBusy(true);
    setStatus({ kind: 'info', text: 'Saving…' });
    try {
      await db.saveBoard(boardId, json);
      setSavedJson(json);
      setStatus({ kind: 'ok', text: 'Saved. His phone picks up the change within a few minutes.' });
      void loadVersions(boardId);
      void syncVoices(boardId, draft);
    } catch (e) {
      setStatus({ kind: 'error', text: `Could not save: ${String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const newLink = async () => {
    const ok = window.confirm(
      'Make a new private link?\n\nThe current link stops working straight away. You then need to open ' +
        'the new link on his phone and add it to the Home screen again.',
    );
    if (!ok) return;
    setBusy(true);
    setStatus({ kind: 'info', text: 'Making a new link…' });
    try {
      const id = await db.moveToNewLink(boardId, savedJson);
      setBoardId(id);
      setStatus({ kind: 'ok', text: 'New link made. The old link no longer works.' });
      void loadVersions(id);
    } catch (e) {
      setStatus({ kind: 'error', text: `Could not make a new link: ${String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const setCategories = (categories: Category[]) => setDraft({ ...draft, categories });
  const homePages = paginate(draft.categories).length;

  return (
    <>
      <section className="ed-card">
        <h2>His private link</h2>
        <p>Open this on his phone, then tap Add to Home screen. Share it only with family and caregivers.</p>
        <div className="ed-link">
          <input readOnly value={linkFor(boardId)} onFocus={(e) => e.target.select()} aria-label="His private link" />
          <button onClick={() => void navigator.clipboard?.writeText(linkFor(boardId))}>Copy</button>
          <a className="ed-button" href={linkFor(boardId)} target="_blank" rel="noreferrer">
            Open
          </a>
        </div>
        <p className="ed-small">
          If the link has been shared too widely,{' '}
          <button className="ed-link-button" disabled={busy || dirty} onClick={newLink}>
            make a new link
          </button>
          {dirty && ' (save your changes first)'}.
        </p>
      </section>

      <div className="ed-savebar">
        <button className="ed-primary" disabled={!dirty || busy || problems.length > 0} onClick={save}>
          Save changes
        </button>
        <button disabled={!dirty || busy} onClick={() => setDraft(parseBoard(savedJson))}>
          Undo changes
        </button>
        <span className="ed-savebar-note">
          {problems.length > 0
            ? 'Fix the problems below to save.'
            : dirty
              ? 'You have unsaved changes.'
              : 'All changes saved.'}
        </span>
      </div>
      {status && <p className={`ed-status ed-${status.kind}`}>{status.text}</p>}
      {voiceStatus && <p className={`ed-status ed-${voiceStatus.kind}`}>{voiceStatus.text}</p>}

      {problems.length > 0 && (
        <section className="ed-card ed-problems" role="alert">
          <h3>Problems to fix before saving</h3>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section className="ed-card ed-warnings">
          <h3>Worth checking</h3>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="ed-card">
        <h2>Home screen buttons</h2>
        <p className="ed-small">
          {draft.categories.length} buttons.{' '}
          {homePages === 1
            ? 'They all fit on one screen.'
            : `His phone shows 5 at a time plus a More button: ${homePages} screens.`}{' '}
          Labels can be at most 3 words.
        </p>
        {draft.categories.map((cat, i) => (
          <CategoryEditor
            key={cat.id}
            category={cat}
            first={i === 0}
            last={i === draft.categories.length - 1}
            onChange={(c) => setCategories(draft.categories.map((x, j) => (j === i ? c : x)))}
            onMove={(by) => setCategories(move(draft.categories, i, by))}
            onRemove={() => {
              if (window.confirm(`Remove "${cat.label}" from the Home screen?`)) {
                setCategories(draft.categories.filter((_, j) => j !== i));
              }
            }}
          />
        ))}
        <button
          onClick={() =>
            setCategories([
              ...draft.categories,
              { id: makeId('new'), label: 'New button', icon: 'what', items: [] },
            ])
          }
        >
          + Add a Home screen button
        </button>
      </section>

      <SettingsEditor board={draft} onChange={setDraft} />

      <section className="ed-card">
        <h2>Previous versions</h2>
        <p className="ed-small">
          The last {db.HISTORY_LIMIT} saves. Loading one puts it in the editor; press Save to send it to his phone.
        </p>
        {versions === null ? (
          <p>Loading…</p>
        ) : (
          <ul className="ed-versions">
            {versions.map((v, i) => (
              <li key={v.id}>
                <span>
                  {formatTime(v.savedAt)}
                  {i === 0 && ' (current)'}
                </span>
                {i > 0 && (
                  <button
                    onClick={() => {
                      const old = parseBoard(v.json);
                      if (old) setDraft(old);
                    }}
                  >
                    Load this version
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function LabelInput({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  const words = wordCount(value);
  const bad = words === 0 || words > 3;
  return (
    <label className="ed-field">
      <span>{name}</span>
      <input className={bad ? 'ed-bad' : ''} value={value} maxLength={40} onChange={(e) => onChange(e.target.value)} />
      <small className={bad ? 'ed-bad-text' : ''}>
        {words === 0 ? 'Needs a label' : words > 3 ? `${words} words: use 3 or fewer` : `${words} of 3 words`}
      </small>
    </label>
  );
}

function PhraseInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const bad = !value.trim() || value.length > MAX_PHRASE_LENGTH;
  return (
    <label className="ed-field ed-wide">
      <span>What the phone says</span>
      <input className={bad ? 'ed-bad' : ''} value={value} onChange={(e) => onChange(e.target.value)} />
      <small className={bad ? 'ed-bad-text' : ''}>
        {!value.trim() ? 'Needs a phrase' : `${value.length} of ${MAX_PHRASE_LENGTH} letters`}
      </small>
    </label>
  );
}

function MoveButtons({
  first,
  last,
  onMove,
  onRemove,
  what,
}: {
  first: boolean;
  last: boolean;
  onMove: (by: number) => void;
  onRemove: () => void;
  what: string;
}) {
  return (
    <div className="ed-row-buttons">
      <button disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${what} up`} title="Move up">
        ↑
      </button>
      <button disabled={last} onClick={() => onMove(1)} aria-label={`Move ${what} down`} title="Move down">
        ↓
      </button>
      <button className="ed-danger" onClick={onRemove} aria-label={`Remove ${what}`} title="Remove">
        ✕
      </button>
    </div>
  );
}

function CategoryEditor({
  category,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  category: Category;
  first: boolean;
  last: boolean;
  onChange: (c: Category) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isList = category.items !== undefined && (category.items.length > 0 || !category.phrase);
  const items = category.items ?? [];

  const setKind = (list: boolean) => {
    if (list) {
      onChange({ id: category.id, label: category.label, icon: category.icon, items });
    } else {
      if (items.length > 0 && !window.confirm(`This removes the ${items.length} items inside "${category.label}".`)) return;
      onChange({ id: category.id, label: category.label, icon: category.icon, phrase: category.phrase ?? '' });
    }
  };
  const setItems = (next: Item[]) => onChange({ ...category, items: next });

  return (
    <div className="ed-category">
      <div className="ed-row">
        <IconPicker icon={category.icon} onPick={(icon) => onChange({ ...category, icon })} />
        <LabelInput name="Button label" value={category.label} onChange={(label) => onChange({ ...category, label })} />
        <MoveButtons first={first} last={last} onMove={onMove} onRemove={onRemove} what={category.label} />
      </div>
      <fieldset className="ed-kind">
        <legend>When he taps it</legend>
        <label>
          <input type="radio" checked={isList} onChange={() => setKind(true)} /> Opens a list of needs
        </label>
        <label>
          <input type="radio" checked={!isList} onChange={() => setKind(false)} /> Says one message
        </label>
      </fieldset>
      {!isList && (
        <div className="ed-row">
          <PhraseInput value={category.phrase ?? ''} onChange={(phrase) => onChange({ ...category, phrase })} />
          <label className="ed-check">
            <input
              type="checkbox"
              checked={!!category.speakOnOpen}
              onChange={(e) => onChange({ ...category, speakOnOpen: e.target.checked || undefined })}
            />{' '}
            Speak straight away with one tap (like Yes and No)
          </label>
        </div>
      )}
      {isList && (
        <div className="ed-items">
          <button className="ed-link-button" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? '▾ Hide' : '▸ Show'} the {items.length} {items.length === 1 ? 'need' : 'needs'} inside
            {items.length > 6 && ' (needs a More page)'}
          </button>
          {open && (
            <>
              {items.map((item, i) => (
                <div className="ed-row ed-item" key={item.id}>
                  <IconPicker icon={item.icon} onPick={(icon) => setItems(items.map((x, j) => (j === i ? { ...x, icon } : x)))} />
                  <LabelInput
                    name="Label"
                    value={item.label}
                    onChange={(label) => setItems(items.map((x, j) => (j === i ? { ...x, label } : x)))}
                  />
                  <PhraseInput
                    value={item.phrase}
                    onChange={(phrase) => setItems(items.map((x, j) => (j === i ? { ...x, phrase } : x)))}
                  />
                  <MoveButtons
                    first={i === 0}
                    last={i === items.length - 1}
                    onMove={(by) => setItems(move(items, i, by))}
                    onRemove={() => setItems(items.filter((_, j) => j !== i))}
                    what={item.label}
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  setItems([...items, { id: makeId('new'), label: 'New need', icon: 'what', phrase: '' }])
                }
              >
                + Add a need to "{category.label}"
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function IconPicker({ icon, onPick }: { icon: string; onPick: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button className="ed-icon-button" onClick={() => setOpen(true)} title="Change picture" aria-label="Change picture">
        <img src={iconUrl(icon)} alt="" />
        <small>Change</small>
      </button>
      {open && (
        <div className="ed-modal" role="dialog" aria-label="Choose a picture" onClick={() => setOpen(false)}>
          <div className="ed-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ed-modal-head">
              <h3>Choose a picture</h3>
              <button onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="ed-icon-grid">
              {__SYMBOLS__.map((name) => (
                <button
                  key={name}
                  className={name === icon ? 'ed-icon-choice is-current' : 'ed-icon-choice'}
                  onClick={() => {
                    onPick(name);
                    setOpen(false);
                  }}
                >
                  <img src={iconUrl(name)} alt="" />
                  <span>{name.replace(/-/g, ' ')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SettingsEditor({ board, onChange }: { board: Board; onChange: (b: Board) => void }) {
  const s = board.settings;
  const set = (patch: Partial<Board['settings']>) => onChange({ ...board, settings: { ...s, ...patch } });
  const seconds = (ms: number) => Math.round(ms / 100) / 10;
  return (
    <section className="ed-card">
      <h2>Touch and sound settings</h2>
      <div className="ed-settings">
        <label className="ed-field">
          <span>Ignore repeat taps for (seconds)</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={seconds(s.repeatDelayMs)}
            onChange={(e) => set({ repeatDelayMs: Math.round(Number(e.target.value) * 1000) })}
          />
          <small>After a press, more taps are ignored for this long. Start: 0.6.</small>
        </label>
        <label className="ed-field">
          <span>Hold before a press counts (seconds)</span>
          <input
            type="number"
            min={0}
            max={3}
            step={0.1}
            value={seconds(s.holdMs)}
            onChange={(e) => set({ holdMs: Math.round(Number(e.target.value) * 1000) })}
          />
          <small>0 turns this off. Try 0.3 if brushes count as presses.</small>
        </label>
        <label className="ed-field">
          <span>Phone voice speed</span>
          <input
            type="number"
            min={0.3}
            max={2}
            step={0.1}
            value={s.speechRate}
            onChange={(e) => set({ speechRate: Number(e.target.value) })}
          />
          <small>Only used when a phrase has no recording yet. 1 is normal.</small>
        </label>
        <label className="ed-check">
          <input type="checkbox" checked={s.speakLabels} onChange={(e) => set({ speakLabels: e.target.checked })} /> Say
          each button's name aloud when pressed
        </label>
      </div>
    </section>
  );
}
