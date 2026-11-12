// Speaking aloud with the voice built into the phone.

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** The parts of a browser voice that matter for choosing one. */
export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

// Higher-quality voices usually say so in their name.
const BETTER = /natural|neural|enhanced|premium|siri/i;
// Ordinary voices that are known to sound reasonable.
const GOOD = /^(samantha|ava|allison|evan|nathan|zoe|tom|alex|google us english)\b/i;
// Joke and effect voices that some phones list alongside real ones.
const NOVELTY =
  /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

/** How suitable a voice is. Below zero means do not use it. */
export function scoreVoice(voice: VoiceInfo): number {
  if (!/^en([-_]|$)/i.test(voice.lang)) return -100;
  let score = 0;
  if (NOVELTY.test(voice.name)) score -= 50;
  if (BETTER.test(voice.name)) score += 8;
  if (GOOD.test(voice.name)) score += 5;
  // The phone's own default follows whatever the family chose in its settings.
  if (voice.default) score += 4;
  if (/^en[-_]US$/i.test(voice.lang)) score += 2;
  // Voices stored on the phone keep working without internet.
  if (voice.localService) score += 1;
  return score;
}

/** The best English voice available, or null to let the phone decide. */
export function pickVoice<T extends VoiceInfo>(voices: T[]): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const voice of voices) {
    const score = scoreVoice(voice);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

// Phones load their list of voices a moment after the page opens.
let voices: SpeechSynthesisVoice[] = [];
if (canSpeak()) {
  const load = () => {
    voices = window.speechSynthesis.getVoices();
  };
  load();
  window.speechSynthesis.addEventListener?.('voiceschanged', load);
}

// Kept here so the phone does not discard it part-way through (an iPhone quirk).
let active: SpeechSynthesisUtterance | null = null;

/** Say the text. Anything already being said is stopped first. */
export function speak(text: string, rate: number, onDone?: () => void): void {
  if (!canSpeak()) {
    onDone?.();
    return;
  }
  const synth = window.speechSynthesis;
  // Only interrupt when something is playing. On iPhones, stopping when
  // nothing is playing can silently swallow the next thing said.
  if (synth.speaking || synth.pending) synth.cancel();
  // Some phones get stuck paused after the app is put in the background.
  synth.resume();

  const utterance = new SpeechSynthesisUtterance(text);
  if (voices.length === 0) voices = synth.getVoices();
  const voice = pickVoice(voices);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'en-US';
  }
  utterance.rate = rate;
  utterance.volume = 1;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(fallback);
    if (active === utterance) active = null;
    onDone?.();
  };
  // Some phones never report that speech ended, so stop waiting eventually.
  const fallback = window.setTimeout(finish, Math.max(4000, text.length * 150));
  utterance.onend = finish;
  utterance.onerror = finish;

  active = utterance;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
}
