import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import boardData from './data/default-board.json';
import { paginate, type Board, type Category, type Item, type Tile } from './board';
import { current, initialNav, navReducer, type NavAction, type NavState } from './nav';
import { PressButton, PressContext } from './PressButton';
import { FitText } from './FitText';
import { canSpeak, speak, stopSpeaking } from './speech';

const board = boardData as Board;

function iconUrl(icon: string): string {
  return `${import.meta.env.BASE_URL}symbols/${icon}.svg`;
}

export function App() {
  const [nav, dispatch] = useReducer(
    (state: NavState, action: NavAction) => navReducer(board, state, action),
    initialNav,
  );
  const lastAcceptedAt = useRef<number | null>(null);
  const press = useMemo(() => ({ settings: board.settings, lastAcceptedAt }), []);
  const screen = current(nav);

  const sayLabel = (label: string) => {
    if (board.settings.speakLabels) speak(label, board.settings.speechRate);
  };

  // Leaving a screen stops anything still being spoken.
  const go = (action: NavAction) => {
    stopSpeaking();
    // Keep one spare step in the browser's history, so a stray swipe-back
    // on the phone goes back inside the board and does not close it.
    if (!window.history.state?.guard) window.history.pushState({ guard: true }, '');
    dispatch(action);
  };

  useEffect(() => {
    const onSystemBack = () => {
      stopSpeaking();
      dispatch({ type: 'back' });
    };
    window.addEventListener('popstate', onSystemBack);
    return () => window.removeEventListener('popstate', onSystemBack);
  }, []);

  const atStart = nav.length === 1 && screen.name === 'home' && screen.page === 0;
  const category =
    screen.name === 'items' ? board.categories.find((c) => c.id === screen.categoryId) : undefined;
  const title = screen.name === 'home' ? 'I need…' : screen.name === 'items' ? (category?.label ?? '') : '';

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
        {title && <h1 className="title">{title}</h1>}

        {screen.name === 'big' && <BigScreen phrase={screen.phrase} />}

        {screen.name === 'home' && (
          <Grid
            tiles={paginate(board.categories)[screen.page]}
            onPick={(c: Category) => {
              sayLabel(c.label);
              go({ type: 'openCategory', category: c });
            }}
            onMore={() => go({ type: 'more' })}
          />
        )}

        {screen.name === 'items' && category && (
          <Grid
            tiles={paginate(category.items ?? [])[screen.page]}
            onPick={(item: Item) => {
              sayLabel(item.label);
              go({ type: 'openItem', item });
            }}
            onMore={() => go({ type: 'more' })}
          />
        )}

        {screen.name === 'message' && (
          <MessageScreen
            phrase={screen.phrase}
            icon={screen.icon}
            onShowBig={() => go({ type: 'showBig' })}
          />
        )}
      </div>
    </PressContext.Provider>
  );
}

function Grid<T extends { id: string; label: string; icon: string }>({
  tiles,
  onPick,
  onMore,
}: {
  tiles: Tile<T>[];
  onPick: (entry: T) => void;
  onMore: () => void;
}) {
  return (
    <main className="grid">
      {tiles.map((tile) =>
        tile.kind === 'more' ? (
          <PressButton key="more" className="tile tile-more" onPress={onMore}>
            <MoreIcon />
            <span className="tile-label">More</span>
          </PressButton>
        ) : (
          <PressButton key={tile.entry.id} className="tile" onPress={() => onPick(tile.entry)}>
            <img className="tile-icon" src={iconUrl(tile.entry.icon)} alt="" draggable={false} />
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
  onShowBig,
}: {
  phrase: string;
  icon: string;
  onShowBig: () => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const speechAvailable = canSpeak();

  return (
    <main className="message">
      <div className="message-phrase">
        <img className="message-icon" src={iconUrl(icon)} alt="" draggable={false} />
        <FitText text={phrase} className="message-text" />
      </div>
      <PressButton
        className={`action action-speak${speaking ? ' is-active' : ''}`}
        disabled={!speechAvailable}
        onPress={() => {
          setSpeaking(true);
          speak(phrase, board.settings.speechRate, () => setSpeaking(false));
        }}
      >
        <SpeakIcon />
        <span>{speechAvailable ? (speaking ? 'Speaking…' : 'Speak') : 'No voice on this phone'}</span>
      </PressButton>
      <PressButton className="action action-big" onPress={onShowBig}>
        <BigIcon />
        <span>Show big</span>
      </PressButton>
    </main>
  );
}

function BigScreen({ phrase }: { phrase: string }) {
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
      <FitText text={phrase} className="big-text" />
    </main>
  );
}

// Simple drawn icons for the controls. Pictures on the tiles come from Mulberry Symbols.

function Svg({ children }: { children: React.ReactNode }) {
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
