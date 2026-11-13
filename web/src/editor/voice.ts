// Makes natural voice recordings inside the browser, with the same Kokoro
// model and voice as tools/make-audio.py. Only loaded on the editor page.
// The first use downloads the voice model (about 90 MB), which the browser
// then keeps.

import { Mp3Encoder } from '@breezystack/lamejs';
import type { KokoroTTS } from 'kokoro-js';
import { VOICE } from '../remote/config';

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// Same speed as tools/make-audio.py.
const SPEED = 0.9;

let model: Promise<KokoroTTS> | null = null;

function loadModel(): Promise<KokoroTTS> {
  model ??= import('kokoro-js')
    .then(({ KokoroTTS }) => KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'wasm' }))
    .catch((error: unknown) => {
      model = null; // Let the next attempt try again.
      throw error;
    });
  return model;
}

/** Speak the phrase with the Kokoro voice and return it as an MP3 file. */
export async function makeRecording(phrase: string): Promise<Uint8Array> {
  const tts = await loadModel();
  const audio = await tts.generate(phrase, { voice: VOICE as 'am_puck', speed: SPEED });
  return encodeMp3(tidy(audio.audio, audio.sampling_rate), audio.sampling_rate);
}

/**
 * Match what tools/make-audio.py does with ffmpeg: trim silence at both ends,
 * add a short lead-in so phones do not clip the first sound, and make every
 * recording about equally loud.
 */
export function tidy(samples: Float32Array, rate: number): Float32Array {
  const quiet = 0.006; // about -45 dB
  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < quiet) start++;
  let end = samples.length;
  while (end > start && Math.abs(samples[end - 1]) < quiet) end--;
  const margin = Math.round(rate * 0.02);
  const speech = samples.subarray(Math.max(0, start - margin), Math.min(samples.length, end + margin));

  let sumSquares = 0;
  let peak = 0;
  for (const s of speech) {
    sumSquares += s * s;
    peak = Math.max(peak, Math.abs(s));
  }
  const rms = Math.sqrt(sumSquares / Math.max(1, speech.length));
  // Aim for about -16 dB average loudness without the loudest part going over -1.5 dB.
  let gain = rms > 0 ? 10 ** (-16 / 20) / rms : 1;
  if (peak * gain > 10 ** (-1.5 / 20)) gain = 10 ** (-1.5 / 20) / peak;

  const leadIn = Math.round(rate * 0.12);
  const out = new Float32Array(leadIn + speech.length);
  for (let i = 0; i < speech.length; i++) out[leadIn + i] = speech[i] * gain;
  return out;
}

function encodeMp3(samples: Float32Array, rate: number): Uint8Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
  }
  const encoder = new Mp3Encoder(1, rate, 48);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) parts.push(encoder.encodeBuffer(pcm.subarray(i, i + 1152)));
  parts.push(encoder.flush());
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
