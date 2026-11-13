// The name of a phrase's recording. Matches file_name() in tools/make-audio.py,
// so the same phrase always gets the same name wherever it was made.

export async function audioId(voice: string, phrase: string): Promise<string> {
  const data = new TextEncoder().encode(`${voice}|${phrase}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}
