import { lazy, Suspense, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import boardData from './data/default-board.json';
import { useBoard } from './boardSource';
import { paginate, type Board, type Category, type Item, type Recipient, type Tile } from './board';
import { colorFor, swatchStyle, type Swatch } from './colors';
import { current, initialNav, navReducer, type NavAction, type NavState } from './nav';
import { PressButton, PressContext } from './PressButton';
import { FitText } from './FitText';
import { canSpeak, speak, stopSpeaking } from './speech';
import { smsLink } from './texting';

const starterBoard = boardData as Board;

// The editor is only loaded on family's devices, never on his phone.
const Editor = lazy(() => import('./editor/Editor'));

/** How long "Said it" shows after something has been spoken. */
const SAID_MS = 2500;

function iconUrl(icon: string): string {
  return `${import.meta.env.BASE_URL}symbols/${icon}.svg`;
}

export function App() {
  if (window.location.hash.startsWith('#edit')) {
    return (
      <Suspense fallback={<p className="editor-loading">Loading the editor…</p>}>
        <Editor />
      </Suspense>
    );
  }
  return <BoardApp />;
}

type SpeakState = 'idle' | 'speaking' | 'said';

function BoardApp() {
  const latest = useBoard(starterBoard);
  // A changed board is only swapped in on the first Home page, so buttons
  // never move under his finger part-way through choosing something.
  const [board, setBoard] = useState(latest);
  const [nav, dispatch] = useReducer(
    (state: NavState, action: NavAction) => navReducer(board, state, action),
    initialNav,
  );
  const lastAcceptedAt = useRef<number | null>(null);
  const press = useMemo(() => ({ settings: board.settings, lastAcceptedAt }), [board]);
  const screen = current(nav);
  const [speakState, setSpeakState] = useState<SpeakState>('idle');
  // A one-tap answer (Yes, No) that was just spoken, shown on its tile.
  const [saidId, setSaidId] = useState<string | null>(null);
  const saidTimer = useRef<number | undefined>(undefined);

  const showSaid = (id: string | null) => {
    window.clearTimeout(saidTimer.current);
    setSaidId(id);
    setSpeakState('said');
    saidTimer.current = window.setTimeout(() => {
      setSaidId(null);
      setSpeakState('idle');
    }, SAID_MS);
  };

  // Runs inside the tap itself, which phones require before they play sound.
  const say = (phrase: string, answerId: string | null = null) => {
    window.clearTimeout(saidTimer.current);
    setSaidId(answerId);
    setSpeakState('speaking');
    speak(phrase, board.settings.speechRate, () => showSaid(answerId));
  };

  const sayLabel = (label: string) => {
    if (board.settings.speakLabels) speak(label, board.settings.speechRate);
  };

  // Leaving a screen stops anything still being spoken.
  const go = (action: NavAction) => {
    stopSpeaking();
    window.clearTimeout(saidTimer.current);
    setSpeakState('idle');
    setSaidId(null);
    // Keep one spare step in the browser's history, so a stray swipe-back
    // on the phone goes back inside the board and does not close it.
    if (!window.history.state?.guard) window.history.pushState({ guard: true }, '');
    dispatch(action);
  };

  useEffect(() => {
    const onSystemBack = () => {
      stopSpeaking();
      setSpeakState('idle');
      dispatch({ type: 'back' });
    };
    window.addEventListener('popstate', onSystemBack);
    return () => window.removeEventListener('popstate', onSystemBack);
  }, []);

  useEffect(() => () => window.clearTimeout(saidTimer.current), []);

  const atStart = nav.length === 1 && screen.name === 'home' && screen.page === 0;
  useEffect(() => {
    if (atStart && latest !== board) setBoard(latest);
  }, [atStart, latest, board]);

  const findCategory = (id: string) => board.categories.find((c) => c.id === id);
  const category = screen.name === 'items' ? findCategory(screen.categoryId) : undefined;
  const homePages = paginate(board.categories);
  const people = board.recipients ?? [];
  const itemPages = category ? paginate(category.items ?? []) : [];

  let content: ReactNode = null;
  let strip: ReactNode = null;

  if (screen.name === 'home') {
    strip = <TitleStrip title="Bro Board" page={screen.page} pages={homePages.length} />;
    content = (
      <Grid
        tiles={homePages[screen.page]}
        lastPage={screen.page === homePages.length - 1}
        swatchOf={(c: Category) => colorFor(c)}
        saidId={saidId}
        onPick={(c: Category) => {
          if (c.speakOnOpen && c.phrase) {
            // Yes and No speak straight away and stay here, ready for the next question.
            stopSpeaking();
            say(c.phrase, c.id);
            return;
          }
          go({ type: 'openCategory', category: c });
          sayLabel(c.label);
        }}
        onMore={() => go({ type: 'more' })}
      />
    );
  } else if (screen.name === 'items' && category) {
    const swatch = colorFor(category);
    strip = (
      <TitleStrip title={category.label} page={screen.page} pages={itemPages.length} swatch={swatch} />
    );
    content = (
      <Grid
        tiles={itemPages[screen.page]}
        lastPage={screen.page === itemPages.length - 1}
        swatchOf={() => swatch}
        saidId={null}
        onPick={(item: Item) => {
          go({ type: 'openItem', item });
          sayLabel(item.label);
        }}
        onMore={() => go({ type: 'more' })}
      />
    );
  } else if (screen.name === 'message') {
    const owner = findCategory(screen.categoryId);
    content = (
      <MessageScreen
        phrase={screen.phrase}
        icon={screen.icon}
        swatch={owner ? colorFor(owner) : null}
        speakState={speakState}
        onSpeak={() => say(screen.phrase)}
        onShowBig={() => go({ type: 'showBig' })}
        onText={people.length > 0 ? () => go({ type: 'text' }) : null}
      />
    );
  } else if (screen.name === 'big') {
    content = <BigScreen phrase={screen.phrase} icon={screen.icon} />;
  } else if (screen.name === 'people') {
    const pages = paginate(people.map(asTile));
    strip = <TitleStrip title="Text who?" page={screen.page} pages={pages.length} />;
    content = (
      <Grid
        tiles={pages[Math.min(screen.page, pages.length - 1)] ?? []}
        lastPage={screen.page === pages.length - 1}
        swatchOf={(p) => colorFor(p)}
        saidId={null}
        onPick={(p) => {
          const person = people.find((r) => r.id === p.id);
          if (person) go({ type: 'pickPerson', person });
        }}
        onMore={() => go({ type: 'more' })}
      />
    );
  } else if (screen.name === 'confirm') {
    const person = people.find((r) => r.id === screen.recipientId);
    strip = <TitleStrip title="Send this text?" page={0} pages={1} />;
    content = person ? (
      <ConfirmScreen
        person={person}
        phrase={screen.phrase}
        onYes={() => {
          // Open Messages inside the tap itself, then start again from Home
          // for when he comes back.
          window.location.assign(smsLink(person.phone, screen.phrase));
          go({ type: 'home' });
        }}
        onNo={() => go({ type: 'back' })}
      />
    ) : null;
  }

  return (
    <PressContext.Provider value={press}>
      <div className="app">
        <header className="bar">
          <PressButton className="bar-button" disabled={atStart} onPress={() => go({ type: 'back' })}>
            <BackIcon />
            <span>Back</span>
          </PressButton>
          <PressButton className="bar-button" disabled={atStart} onPress={() => go({ type: 'home' })}>
            <HomeIcon />
            <span>Home</span>
          </PressButton>
        </header>
        {strip}
        {content}
        <p className="visually-hidden" aria-live="polite">
          {speakState === 'said' ? 'Said it.' : ''}
        </p>
      </div>
    </PressContext.Provider>
  );
}

/** Where he is: the screen's name and, when there is more than one page, which page. */
function TitleStrip({
  title,
  page,
  pages,
  swatch,
}: {
  title: string;
  page: number;
  pages: number;
  swatch?: Swatch;
}) {
  return (
    <div className={swatch ? 'strip strip-tinted' : 'strip'} style={swatch ? swatchStyle(swatch) : undefined}>
      <h1 className="strip-title">{title}</h1>
      {pages > 1 && (
        <span className="strip-page">
          Page {page + 1} of {pages}
        </span>
      )}
    </div>
  );
}

function Grid<T extends { id: string; label: string; icon: string }>({
  tiles,
  lastPage,
  swatchOf,
  saidId,
  onPick,
  onMore,
}: {
  tiles: Tile<T>[];
  lastPage: boolean;
  swatchOf: (entry: T) => Swatch;
  saidId: string | null;
  onPick: (entry: T) => void;
  onMore: () => void;
}) {
  return (
    <main className="grid">
      {tiles.map((tile) =>
        tile.kind === 'more' ? (
          <PressButton key="more" className="tile tile-more" onPress={onMore}>
            {lastPage ? <StartIcon /> : <MoreIcon />}
            <span className="tile-label">{lastPage ? 'Back to start' : 'More'}</span>
          </PressButton>
        ) : (
          <PressButton
            key={tile.entry.id}
            className={tile.entry.id === saidId ? 'tile is-said' : 'tile'}
            style={swatchStyle(swatchOf(tile.entry))}
            onPress={() => onPick(tile.entry)}
          >
            <span className="tile-picture">
              <img className="tile-icon" src={iconUrl(tile.entry.icon)} alt="" draggable={false} />
              {tile.entry.id === saidId && (
                <span className="tile-said">
                  <CheckIcon />
                </span>
              )}
            </span>
            <span className="tile-label">{tile.entry.label}</span>
          </PressButton>
        ),
      )}
    </main>
  );
}

function MessageScreen({
  phrase,
  icon,
  swatch,
  speakState,
  onSpeak,
  onShowBig,
  onText,
}: {
  phrase: string;
  icon: string;
  swatch: Swatch | null;
  speakState: SpeakState;
  onSpeak: () => void;
  onShowBig: () => void;
  onText: (() => void) | null;
}) {
  const speechAvailable = canSpeak(phrase);
  const speakLabel = !speechAvailable
    ? 'No voice on this phone'
    : speakState === 'speaking'
      ? 'Speaking…'
      : speakState === 'said'
        ? 'Said it'
        : 'Speak';

  return (
    <main className={onText ? 'message has-text' : 'message'}>
      <div className="message-phrase" style={swatch ? swatchStyle(swatch) : undefined}>
        <img className="message-icon" src={iconUrl(icon)} alt="" draggable={false} />
        <FitText text={phrase} className="message-text" />
      </div>
      <PressButton
        className={`action action-speak is-${speakState}`}
        disabled={!speechAvailable}
        onPress={onSpeak}
      >
        {speakState === 'said' ? <CheckIcon /> : <SpeakIcon />}
        <span>{speakLabel}</span>
      </PressButton>
      <PressButton className="action action-big" onPress={onShowBig}>
        <BigIcon />
        <span>Show big</span>
      </PressButton>
      {onText && (
        <PressButton className="action action-text" onPress={onText}>
          <TextIcon />
          <span>Text</span>
        </PressButton>
      )}
    </main>
  );
}

/** A person as a grid button. */
function asTile(person: Recipient) {
  return { id: person.id, label: person.name, icon: person.icon };
}

/** Yes / No before Messages opens, so a stray tap never starts a text. */
function ConfirmScreen({
  person,
  phrase,
  onYes,
  onNo,
}: {
  person: Recipient;
  phrase: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <main className="confirm">
      <div className="confirm-card" style={swatchStyle(colorFor(person))}>
        <img className="confirm-icon" src={iconUrl(person.icon)} alt="" draggable={false} />
        <p className="confirm-to">To {person.name}</p>
        <FitText text={phrase} className="confirm-text" />
      </div>
      <div className="confirm-answers">
        <PressButton className="tile confirm-yes" style={swatchStyle(colorFor({ id: 'yes', color: 'green' }))} onPress={onYes}>
          <span className="tile-picture">
            <img className="tile-icon" src={iconUrl('yes')} alt="" draggable={false} />
          </span>
          <span className="tile-label">Yes, text</span>
        </PressButton>
        <PressButton className="tile confirm-no" style={swatchStyle(colorFor({ id: 'no', color: 'red' }))} onPress={onNo}>
          <span className="tile-picture">
            <img className="tile-icon" src={iconUrl('no')} alt="" draggable={false} />
          </span>
          <span className="tile-label">No</span>
        </PressButton>
      </div>
    </main>
  );
}

function BigScreen({ phrase, icon }: { phrase: string; icon: string }) {
  // Keep the screen on while the message is showing, where the phone allows it.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock?.request('screen');
        if (!sentinel) return;
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      } catch {
        // Not supported or not allowed. The message still shows.
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);

  return (
    <main className="big">
      <img className="big-icon" src={iconUrl(icon)} alt="" draggable={false} />
      <FitText text={phrase} className="big-text" />
    </main>
  );
}

// Simple drawn icons for the controls. Pictures on the tiles come from Mulberry Symbols.

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const BackIcon = () => (
  <Svg>
    <path d="M11 5l-7 7 7 7M4 12h16" />
  </Svg>
);
const HomeIcon = () => (
  <Svg>
    <path d="M3 11l9-8 9 8M6 9.5V20h12V9.5" />
  </Svg>
);
const MoreIcon = () => (
  <Svg>
    <path d="M13 5l7 7-7 7M20 12H4" />
  </Svg>
);
const StartIcon = () => (
  <Svg>
    <path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" />
  </Svg>
);
const SpeakIcon = () => (
  <Svg>
    <path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
  </Svg>
);
const BigIcon = () => (
  <Svg>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Svg>
);
const TextIcon = () => (
  <Svg>
    <path d="M4 5h16v11H9l-5 4V5zM8 9.5h8M8 12.5h5" />
  </Svg>
);
const CheckIcon = () => (
  <Svg>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
