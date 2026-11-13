// The editor page, for approved family members. Opened with …/bro-board/#edit.
// Nothing here is reachable from his screens.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  type Recipient,
} from '../board';
import { COLOR_NAMES, PALETTE, colorFor, swatchStyle, type ColorName } from '../colors';
import { audioId } from '../remote/audioId';
import { VOICE } from '../remote/config';
import { recordingFor } from '../speech';
import { formatPhone, normalizePhone, textBody } from '../texting';
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

/** Turn a technical error into words a family member can act on. */
function friendly(error: unknown): string {
  const code = (error as { code?: string }).code ?? '';
  if (code.includes('permission-denied')) {
    return 'This account is not allowed to change the board. Check you are signed in with the approved email.';
  }
  if (code.includes('unavailable') || code.includes('network') || !navigator.onLine) {
    return 'No internet connection. Your changes are still here; try again when you are back online.';
  }
  if (code.includes('unauthenticated')) return 'You have been signed out. Sign in again, then try once more.';
  return `Something went wrong${code ? ` (${code})` : ''}. Your changes are still here; please try again.`;
}

export default function Editor() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [signInError, setSignInError] = useState('');

  useEffect(() => {
    document.body.classList.add('editing');
    document.title = 'Bro Board editor';
    // His board blocks pinch-zoom; family editing it may need to zoom.
    const viewport = document.querySelector('meta[name="viewport"]');
    const before = viewport?.getAttribute('content') ?? null;
    viewport?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    return () => {
      document.body.classList.remove('editing');
      if (viewport && before) viewport.setAttribute('content', before);
    };
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
        setSignInError(
          code === 'auth/popup-blocked'
            ? 'Your browser blocked the sign-in window. Allow pop-ups for this page, then try again.'
            : friendly(e),
        );
      }
    }
  };

  let body;
  if (user === undefined) {
    body = <p className="ed-quiet">Loading…</p>;
  } else if (!user) {
    body = (
      <section className="ed-card ed-welcome">
        <img src={iconUrl('family')} alt="" className="ed-welcome-art" />
        <h2>Change his buttons from here</h2>
        <p>Sign in with the Google account the family added to Bro Board.</p>
        <button className="ed-primary ed-large" onClick={signIn}>
          Sign in with Google
        </button>
        {signInError && <p className="ed-status ed-error">{signInError}</p>}
      </section>
    );
  } else if (approved === null) {
    body = <p className="ed-quiet">Checking your access…</p>;
  } else if (!approved) {
    body = (
      <section className="ed-card ed-welcome">
        <h2>This account isn't on the list yet</h2>
        <p>
          You're signed in as <strong>{user.email}</strong>. Ask the family member who set up Bro Board to add this
          email to the approved editors, then reload this page.
        </p>
        <button onClick={() => void db.signOut()}>Use a different account</button>
      </section>
    );
  } else {
    body = <Workspace />;
  }

  return (
    <div className="ed">
      <header className="ed-header">
        <h1>
          Bro Board <span>editor</span>
        </h1>
        {user && approved && (
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
  const [justSaved, setJustSaved] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState<{ done: number; total: number } | null>(null);
  const [versions, setVersions] = useState<db.Version[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      setVoiceProgress({ done: 0, total: missing.length });
      for (const [i, [audio, phrase]] of missing.entries()) {
        setVoiceStatus({
          kind: 'info',
          text:
            `Making voice recording ${i + 1} of ${missing.length} (${phrase}). ` +
            (i === 0 ? 'The first one can take a minute while the voice downloads. ' : '') +
            'Please keep this page open.',
        });
        await db.saveRecording(id, audio, phrase, VOICE, await makeRecording(phrase));
        setVoiceProgress({ done: i + 1, total: missing.length });
      }
      setVoiceStatus({ kind: 'ok', text: 'Voice recordings are ready. His phone picks them up within a few minutes.' });
    } catch (e) {
      setVoiceStatus({
        kind: 'error',
        text:
          `Couldn't make the voice recordings. ${friendly(e)} Until they're made, his phone uses its own ` +
          'voice for new phrases. They are tried again each time you save or open this page.',
      });
    } finally {
      setVoiceProgress(null);
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
        const found = boards.find((b) => parseBoard(b.json));
        if (!found) {
          setBoardId(null);
          return;
        }
        setBoardId(found.id);
        setSavedJson(found.json);
        setDraft(parseBoard(found.json));
        void loadVersions(found.id);
        void syncVoices(found.id, parseBoard(found.json)!);
      } catch (e) {
        setLoadError(friendly(e));
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

  if (loadError) return <p className="ed-status ed-error">Couldn't load his board. {loadError}</p>;
  if (boardId === undefined) return <p className="ed-quiet">Loading his board…</p>;

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
        setStatus({ kind: 'error', text: `Couldn't create the board. ${friendly(e)}` });
      } finally {
        setBusy(false);
      }
    };
    return (
      <section className="ed-card ed-welcome">
        <h2>Start his board</h2>
        <p>
          Bro Board starts with a ready-made set of buttons (food, bathroom, pain, yes and no, and more). You can
          change any of them afterwards. You'll get a private link to open on his phone.
        </p>
        <button className="ed-primary ed-large" disabled={busy} onClick={create}>
          Create his board
        </button>
        {status && <p className={`ed-status ed-${status.kind}`}>{status.text}</p>}
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
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1800);
      setStatus({ kind: 'ok', text: 'Saved. His phone picks up the change within a few minutes.' });
      void loadVersions(boardId);
      void syncVoices(boardId, draft);
    } catch (e) {
      setStatus({ kind: 'error', text: `Couldn't save. ${friendly(e)}` });
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
      setStatus({
        kind: 'ok',
        text: 'New link made. The old one no longer works. Open the new link on his phone and add it to the Home screen.',
      });
      void loadVersions(id);
    } catch (e) {
      setStatus({ kind: 'error', text: `Couldn't make a new link. ${friendly(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkFor(boardId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The link box can still be selected and copied by hand.
    }
  };

  const setCategories = (categories: Category[]) => setDraft({ ...draft, categories });
  const pages = paginate(draft.categories);
  const openCategory = (id: string) => {
    setOpenId(id);
    window.requestAnimationFrame(() =>
      document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };
  const addCategory = () => {
    const id = makeId('new');
    const used = new Set(draft.categories.map((c) => c.color));
    const color = COLOR_NAMES.find((c) => !used.has(c)) ?? 'sand';
    setCategories([...draft.categories, { id, label: 'New button', icon: 'what', color, items: [] }]);
    openCategory(id);
  };

  // Which screen each Home button lands on: 6 fit on one, otherwise 5 per screen plus More.
  let index = 0;
  const groups = pages.map((page, p) => {
    const entries = page.flatMap((t) => (t.kind === 'entry' ? [t.entry] : []));
    const start = index;
    index += entries.length;
    return { screen: p + 1, entries, start };
  });

  return (
    <>
      <div className="ed-savebar">
        <button
          className={justSaved ? 'ed-primary is-saved' : 'ed-primary'}
          disabled={!dirty || busy || problems.length > 0}
          onClick={save}
        >
          {justSaved ? (
            <>
              <CheckIcon /> Saved
            </>
          ) : (
            'Save changes'
          )}
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
      {voiceStatus && (
        <div className={`ed-status ed-${voiceStatus.kind}`}>
          <p>{voiceStatus.text}</p>
          {voiceProgress && (
            <div
              className="ed-progress"
              role="progressbar"
              aria-label="Voice recordings made"
              aria-valuemin={0}
              aria-valuemax={voiceProgress.total}
              aria-valuenow={voiceProgress.done}
            >
              {/* Starts a sliver in, so it never looks stuck at nothing. */}
              <span style={{ width: `${Math.max(6, (voiceProgress.done / voiceProgress.total) * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {problems.length > 0 && (
        <section className="ed-note ed-problems" role="alert">
          <h2>Fix before saving</h2>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section className="ed-note ed-warnings">
          <h2>Worth checking</h2>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="ed-layout">
        <aside className="ed-preview-col" aria-label="Preview of his phone">
          <PhonePreview board={draft} openId={openId} onPick={openCategory} />
        </aside>

        <div className="ed-main">
          <section className="ed-card">
            <h2>His Home screen</h2>
            <p className="ed-hint">
              Up to 6 buttons fit on a screen. With more, his phone shows 5 at a time and a More button. Labels can be
              at most 3 words.
            </p>
            {groups.map((group) => (
              <div key={group.screen} className="ed-screen-group">
                {groups.length > 1 && <h3 className="ed-screen-heading">Screen {group.screen}</h3>}
                {group.entries.map((cat, j) => {
                  const i = group.start + j;
                  return (
                    <CategoryEditor
                      key={cat.id}
                      category={cat}
                      open={openId === cat.id}
                      onToggle={() => setOpenId(openId === cat.id ? null : cat.id)}
                      first={i === 0}
                      last={i === draft.categories.length - 1}
                      onChange={(c) => setCategories(draft.categories.map((x, k) => (k === i ? c : x)))}
                      onMove={(by) => setCategories(move(draft.categories, i, by))}
                      onRemove={() => {
                        if (window.confirm(`Remove "${cat.label}" from his Home screen?`)) {
                          setCategories(draft.categories.filter((_, k) => k !== i));
                        }
                      }}
                    />
                  );
                })}
              </div>
            ))}
            <button className="ed-add" onClick={addCategory}>
              <PlusIcon /> Add a Home screen button
            </button>
          </section>

          <PeopleEditor board={draft} onChange={setDraft} />

          <SettingsEditor board={draft} onChange={setDraft} />

          <section className="ed-card">
            <h2>Open it on his phone</h2>
            <ol className="ed-steps">
              <li>Send this link to his phone, or open it there.</li>
              <li>In Chrome, tap the ⋮ menu, then Add to Home screen.</li>
              <li>From then on he opens Bro Board from its Home screen icon.</li>
            </ol>
            <div className="ed-link">
              <input readOnly value={linkFor(boardId)} onFocus={(e) => e.target.select()} aria-label="His private link" />
              <button onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
              <a className="ed-button" href={linkFor(boardId)} target="_blank" rel="noreferrer">
                Open
              </a>
            </div>
          </section>

          <section className="ed-card">
            <h2>Earlier versions</h2>
            <p className="ed-hint">
              The last {db.HISTORY_LIMIT} saves. Loading one puts it in the editor; press Save to send it to his phone.
            </p>
            {versions === null ? (
              <p className="ed-quiet">Loading…</p>
            ) : (
              <ul className="ed-versions">
                {versions.map((v, i) => (
                  <li key={v.id}>
                    <span>
                      {formatTime(v.savedAt)}
                      {i === 0 && <em> · on his phone now</em>}
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

          <section className="ed-card ed-privacy">
            <h2>Privacy</h2>
            <p>
              Anyone with his link can see his board, but only approved family can change it. If the link has been
              shared too widely, make a new one. The old link stops working straight away.
            </p>
            <button className="ed-danger-button" disabled={busy || dirty} onClick={newLink}>
              Make a new link
            </button>
            {dirty && <p className="ed-hint">Save or undo your changes first.</p>}
          </section>
        </div>
      </div>
    </>
  );
}

/** A small copy of his phone, built from the same layout rules, so family can see what he will see. */
function PhonePreview({
  board,
  openId,
  onPick,
}: {
  board: Board;
  openId: string | null;
  onPick: (id: string) => void;
}) {
  const open = board.categories.find((c) => c.id === openId && (c.items?.length ?? 0) > 0);
  const homePages = paginate(board.categories);
  // A button glows briefly when it changes. Screens that just appeared (for
  // example when a category is opened) and the first load stay still.
  const before = useRef(new Map<string, string>());
  const seen = new Map<string, string>();
  const changed = (screen: string, t: MiniTile) => {
    const key = `${screen}:${t.key}`;
    const look = `${t.label}|${t.icon}|${t.style?.['--tile'] ?? ''}`;
    seen.set(key, look);
    const old = before.current.get(key);
    if (old !== undefined) return old !== look;
    return [...before.current.keys()].some((k) => k.startsWith(`${screen}:`));
  };
  useEffect(() => {
    before.current = seen;
  });
  const mark = (screen: string, tiles: MiniTile[]) => tiles.map((t) => ({ ...t, changed: changed(screen, t) }));
  return (
    <div className="ed-preview">
      <h2>His phone</h2>
      <p className="ed-hint">Tap a button to edit it.</p>
      {homePages.map((page, p) => (
        <MiniScreen
          key={`home-${p}`}
          title={`Home${homePages.length > 1 ? ` · screen ${p + 1}` : ''}`}
          tiles={mark(
            `home-${p}`,
            page.map((t) =>
              t.kind === 'more'
                ? { key: 'more', more: true, label: p === homePages.length - 1 ? 'Back to start' : 'More' }
                : {
                    key: t.entry.id,
                    label: t.entry.label,
                    icon: t.entry.icon,
                    style: swatchStyle(colorFor(t.entry)),
                    current: t.entry.id === openId,
                    onPick: () => onPick(t.entry.id),
                  },
            ),
          )}
        />
      ))}
      {open &&
        paginate(open.items ?? []).map((page, p, all) => (
          <MiniScreen
            key={`open-${p}`}
            title={`${open.label}${all.length > 1 ? ` · screen ${p + 1}` : ''}`}
            tiles={mark(
              `open-${open.id}-${p}`,
              page.map((t) =>
                t.kind === 'more'
                  ? { key: 'more', more: true, label: p === all.length - 1 ? 'Back to start' : 'More' }
                  : { key: t.entry.id, label: t.entry.label, icon: t.entry.icon, style: swatchStyle(colorFor(open)) },
              ),
            )}
          />
        ))}
      {paginate(board.recipients ?? []).map((page, p, all) =>
        (board.recipients?.length ?? 0) === 0 ? null : (
          <MiniScreen
            key={`people-${p}`}
            title={`Text who?${all.length > 1 ? ` · screen ${p + 1}` : ''}`}
            tiles={mark(
              `people-${p}`,
              page.map((t) =>
                t.kind === 'more'
                  ? { key: 'more', more: true, label: p === all.length - 1 ? 'Back to start' : 'More' }
                  : { key: t.entry.id, label: t.entry.name, icon: t.entry.icon, style: swatchStyle(PALETTE.purple) },
              ),
            )}
          />
        ),
      )}
    </div>
  );
}

interface MiniTile {
  key: string;
  label: string;
  icon?: string;
  more?: boolean;
  style?: Record<string, string>;
  current?: boolean;
  /** Changed since the last look: glows briefly. */
  changed?: boolean;
  onPick?: () => void;
}

function MiniScreen({ title, tiles }: { title: string; tiles: MiniTile[] }) {
  return (
    <figure className="ed-mini">
      <figcaption>{title}</figcaption>
      <div className="ed-mini-grid">
        {tiles.map((t) =>
          t.onPick ? (
            <button
              key={`${t.key}|${t.label}|${t.icon}|${t.style?.['--tile'] ?? ''}`}
              className={`ed-mini-tile${t.current ? ' is-current' : ''}${t.changed ? ' is-changed' : ''}`}
              style={t.style}
              onClick={t.onPick}
              aria-label={`Edit ${t.label}`}
            >
              {t.icon && <img src={iconUrl(t.icon)} alt="" />}
              <span>{t.label}</span>
            </button>
          ) : (
            <div
              key={`${t.key}|${t.label}|${t.icon}|${t.style?.['--tile'] ?? ''}`}
              className={`ed-mini-tile${t.more ? ' ed-mini-more' : ''}${t.changed ? ' is-changed' : ''}`}
              style={t.style}
            >
              {t.icon && <img src={iconUrl(t.icon)} alt="" />}
              <span>{t.label}</span>
            </div>
          ),
        )}
      </div>
    </figure>
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
      <textarea className={bad ? 'ed-bad' : ''} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      <small className={bad ? 'ed-bad-text' : ''}>
        {!value.trim() ? 'Needs a phrase' : `${value.length} of ${MAX_PHRASE_LENGTH} letters`}
      </small>
    </label>
  );
}

function RowButtons({
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
      <button disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${what} up`}>
        <ArrowIcon up /> Up
      </button>
      <button disabled={last} onClick={() => onMove(1)} aria-label={`Move ${what} down`}>
        <ArrowIcon /> Down
      </button>
      <button className="ed-danger" onClick={onRemove} aria-label={`Remove ${what}`}>
        <TrashIcon /> Remove
      </button>
    </div>
  );
}

function ColorPicker({ id, value, onChange }: { id: string; value: string; onChange: (c: ColorName) => void }) {
  return (
    <fieldset className="ed-colors">
      <legend>Colour</legend>
      {COLOR_NAMES.map((name) => (
        <label key={name} className="ed-swatch" title={PALETTE[name].name}>
          <input type="radio" name={`color-${id}`} checked={value === name} onChange={() => onChange(name)} />
          <span style={{ background: PALETTE[name].tint, borderColor: PALETTE[name].deep }} aria-hidden="true" />
          <em className="visually-hidden">{PALETTE[name].name}</em>
        </label>
      ))}
    </fieldset>
  );
}

function CategoryEditor({
  category,
  open,
  onToggle,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  category: Category;
  open: boolean;
  onToggle: () => void;
  first: boolean;
  last: boolean;
  onChange: (c: Category) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const isList = category.items !== undefined && (category.items.length > 0 || !category.phrase);
  const items = category.items ?? [];
  const swatch = colorFor(category);
  const colorName = COLOR_NAMES.find((n) => PALETTE[n] === swatch) ?? 'sand';
  const bad = validateBoard({ version: 1, settings: { repeatDelayMs: 600, holdMs: 0, speakLabels: false, speechRate: 1 }, categories: [category] }).length > 0;

  const setKind = (list: boolean) => {
    const base = { id: category.id, label: category.label, icon: category.icon, color: category.color };
    if (list) {
      onChange({ ...base, items });
    } else {
      if (items.length > 0 && !window.confirm(`This removes the ${items.length} needs inside "${category.label}".`)) return;
      onChange({ ...base, phrase: category.phrase ?? '' });
    }
  };
  const setItems = (next: Item[]) => onChange({ ...category, items: next });

  return (
    <div className={open ? 'ed-category is-open' : 'ed-category'} id={`cat-${category.id}`}>
      <button className="ed-summary" onClick={onToggle} aria-expanded={open}>
        <span className="ed-summary-tile" style={swatchStyle(swatch)}>
          <img src={iconUrl(category.icon)} alt="" />
        </span>
        <span className="ed-summary-text">
          <strong>{category.label || 'Untitled'}</strong>
          <small>
            {isList
              ? `${items.length} ${items.length === 1 ? 'need' : 'needs'} inside`
              : category.speakOnOpen
                ? 'Speaks with one tap'
                : 'Says one message'}
            {bad && <span className="ed-bad-text"> · needs fixing</span>}
          </small>
        </span>
        <span className="ed-summary-action">{open ? 'Close' : 'Edit'}</span>
      </button>

      {open && (
        <div className="ed-category-body">
          <div className="ed-row">
            <IconPicker icon={category.icon} onPick={(icon) => onChange({ ...category, icon })} />
            <LabelInput name="Button label" value={category.label} onChange={(label) => onChange({ ...category, label })} />
          </div>
          <ColorPicker id={category.id} value={colorName} onChange={(color) => onChange({ ...category, color })} />
          <fieldset className="ed-kind">
            <legend>When he taps it</legend>
            <label>
              <input type="radio" checked={isList} onChange={() => setKind(true)} /> It opens a list of needs
            </label>
            <label>
              <input type="radio" checked={!isList} onChange={() => setKind(false)} /> It says one message
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
                />
                Speak straight away with one tap, and stay on Home (like Yes and No)
              </label>
            </div>
          )}
          {isList && (
            <div className="ed-items">
              <h4>
                Needs inside "{category.label}"{items.length > 6 && <small> · needs a More page</small>}
              </h4>
              {items.map((item, i) => (
                <div className="ed-item" key={item.id}>
                  <IconPicker
                    icon={item.icon}
                    onPick={(icon) => setItems(items.map((x, j) => (j === i ? { ...x, icon } : x)))}
                  />
                  <div className="ed-item-fields">
                    <LabelInput
                      name="Label"
                      value={item.label}
                      onChange={(label) => setItems(items.map((x, j) => (j === i ? { ...x, label } : x)))}
                    />
                    <PhraseInput
                      value={item.phrase}
                      onChange={(phrase) => setItems(items.map((x, j) => (j === i ? { ...x, phrase } : x)))}
                    />
                  </div>
                  <RowButtons
                    first={i === 0}
                    last={i === items.length - 1}
                    onMove={(by) => setItems(move(items, i, by))}
                    onRemove={() => {
                      if (window.confirm(`Remove "${item.label}"?`)) setItems(items.filter((_, j) => j !== i));
                    }}
                    what={item.label}
                  />
                </div>
              ))}
              <button
                className="ed-add"
                onClick={() => setItems([...items, { id: makeId('new'), label: 'New need', icon: 'what', phrase: '' }])}
              >
                <PlusIcon /> Add a need
              </button>
            </div>
          )}
          <div className="ed-category-foot">
            <span className="ed-hint">Move or remove this Home button:</span>
            <RowButtons first={first} last={last} onMove={onMove} onRemove={onRemove} what={category.label} />
          </div>
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
      <button className="ed-icon-button" onClick={() => setOpen(true)} aria-label="Change picture">
        <img src={iconUrl(icon)} alt="" />
        <small>Change picture</small>
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

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // What they typed stays as typed; the board keeps the international form.
  const [text, setText] = useState(() => (value ? formatPhone(value) : ''));
  const normalized = normalizePhone(text);
  // Follow changes made elsewhere (Undo, or loading an earlier version).
  useEffect(() => {
    if (value !== text && value !== normalizePhone(text)) setText(value ? formatPhone(value) : '');
  }, [value, text]);
  return (
    <label className="ed-field">
      <span>Mobile number</span>
      <input
        className={normalized ? '' : 'ed-bad'}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="(555) 212-3456"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(normalizePhone(e.target.value) ?? e.target.value);
        }}
      />
      <small className={normalized ? 'ed-ok-text' : 'ed-bad-text'}>
        {normalized
          ? `Texts go to ${formatPhone(normalized)}`
          : text.trim()
            ? 'Not a full number yet. US numbers need 10 digits; others start with +.'
            : 'Needs a number'}
      </small>
    </label>
  );
}

function PeopleEditor({ board, onChange }: { board: Board; onChange: (b: Board) => void }) {
  const people = board.recipients ?? [];
  const set = (next: Recipient[]) => onChange({ ...board, recipients: next });
  const update = (i: number, patch: Partial<Recipient>) => set(people.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <section className="ed-card">
      <h2>People he can text</h2>
      <p className="ed-hint">
        When anyone is listed here, his message screen gets a Text button. He picks a person, says Yes, and his
        Messages app opens with the words filled in, for example "{textBody('I am hungry.')}". He taps Send there; it
        comes from his own number.
      </p>
      {people.length === 0 && <p className="ed-quiet">Nobody yet, so the Text button is hidden.</p>}
      {people.map((person, i) => (
        <div className="ed-item ed-person" key={person.id}>
          <IconPicker icon={person.icon} onPick={(icon) => update(i, { icon })} />
          <div className="ed-item-fields">
            <LabelInput name="Name on his button" value={person.name} onChange={(name) => update(i, { name })} />
            <PhoneInput value={person.phone} onChange={(phone) => update(i, { phone })} />
          </div>
          <RowButtons
            first={i === 0}
            last={i === people.length - 1}
            onMove={(by) => set(move(people, i, by))}
            onRemove={() => {
              if (window.confirm(`Remove ${person.name} from the people he can text?`)) {
                set(people.filter((_, j) => j !== i));
              }
            }}
            what={person.name}
          />
        </div>
      ))}
      <button
        className="ed-add"
        onClick={() => set([...people, { id: makeId('person'), name: 'New person', phone: '', icon: 'family' }])}
      >
        <PlusIcon /> Add a person
      </button>
    </section>
  );
}

function Choice({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  options: [number, string][];
  onChange: (v: number) => void;
}) {
  // Keep a value set some other way, so choosing nothing never changes it.
  const all = options.some(([v]) => v === value) ? options : [...options, [value, `${value} (current)`] as [number, string]];
  return (
    <label className="ed-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {all.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      <small>{hint}</small>
    </label>
  );
}

function SettingsEditor({ board, onChange }: { board: Board; onChange: (b: Board) => void }) {
  const s = board.settings;
  const set = (patch: Partial<Board['settings']>) => onChange({ ...board, settings: { ...s, ...patch } });
  return (
    <section className="ed-card">
      <h2>Touch and sound</h2>
      <div className="ed-settings">
        <Choice
          label="After a press, ignore taps for"
          hint="Stops one shaky press counting twice."
          value={s.repeatDelayMs}
          options={[
            [300, '0.3 seconds'],
            [600, '0.6 seconds (start here)'],
            [1000, '1 second'],
            [1500, '1.5 seconds'],
            [2000, '2 seconds'],
          ]}
          onChange={(repeatDelayMs) => set({ repeatDelayMs })}
        />
        <Choice
          label="Finger must rest on a button for"
          hint="Try a short hold if brushes count as presses."
          value={s.holdMs}
          options={[
            [0, 'No hold (start here)'],
            [200, '0.2 seconds'],
            [400, '0.4 seconds'],
            [600, '0.6 seconds'],
            [1000, '1 second'],
          ]}
          onChange={(holdMs) => set({ holdMs })}
        />
        <Choice
          label="Phone voice speed"
          hint="Only used for a phrase that has no recording yet."
          value={s.speechRate}
          options={[
            [0.7, 'Slowest'],
            [0.9, 'Slower (start here)'],
            [1, 'Normal'],
            [1.2, 'Faster'],
          ]}
          onChange={(speechRate) => set({ speechRate })}
        />
        <div className="ed-checks">
          <label className="ed-check">
            <input type="checkbox" checked={s.vibrate !== false} onChange={(e) => set({ vibrate: e.target.checked })} />
            A gentle buzz when a press counts
          </label>
          <label className="ed-check">
            <input
              type="checkbox"
              checked={s.animations !== false}
              onChange={(e) => set({ animations: e.target.checked })}
            />
            Little animations (a tick that draws itself, a soft glow, springy buttons)
          </label>
          <label className="ed-check">
            <input type="checkbox" checked={s.speakLabels} onChange={(e) => set({ speakLabels: e.target.checked })} />
            Say each button's name aloud when pressed
          </label>
        </div>
      </div>
    </section>
  );
}

// Drawn icons, matching his board's icon style.

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className="ed-ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const CheckIcon = () => (
  <Svg>
    <path className="tick-path" d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
const ArrowIcon = ({ up }: { up?: boolean }) => (
  <Svg>
    <path d={up ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M19 12l-7 7-7-7'} />
  </Svg>
);
const TrashIcon = () => (
  <Svg>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Svg>
);
const PlusIcon = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
