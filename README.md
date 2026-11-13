# Bro Board

A simple web app with big buttons that helps a person with Huntington's disease tell family and caregivers what he needs, without relying on speech or precise touch.

He picks a category (for example "Bathroom"), then a specific need ("Going pee"), then chooses how to say it:

- **Speak**: the phone says it aloud
- **Show big**: the message fills the screen
- **Text**: his Messages app opens with a person and the message already filled in

Family can change the buttons remotely from their own phone or computer.

## Status

Stages 1 and 2 are built: categories, items, Speak and Show big, plus remote editing by family. Texting (stage 3) comes next.

- [Changing his board](docs/family-editing.md): the editor, his private link, and adding approved editors
- [Product requirements (PRD)](docs/PRD.md): what the app must do and why
- [Interview notes](docs/interview-notes.md): the answers the PRD is based on

## How it gets onto his phone

1. Someone texts him his private link (shown in the editor).
2. He or a caregiver opens it in Chrome and taps **Add to Home screen**.
3. The app then has its own icon and opens full screen. Updates arrive automatically.

## Working on the app

The app lives in the `web` folder. With [Node.js](https://nodejs.org/) installed:

```bash
cd web
npm install
npm run dev
```

`npm test` runs the checks and `npm run build` makes the files that get published.

The starter buttons are in `web/src/data/default-board.json`. Each button has a short label, a picture name from `web/public/symbols`, and the phrase that is spoken or shown. A new board made in the editor starts from these.

Each starter phrase has a voice recording in `web/public/audio`. After changing or adding a starter phrase, run `tools/make-audio.py` again (instructions are at the top of that file) to make the missing recordings. The tests fail if a starter phrase has no recording. Phrases added in the editor get their recordings from the editor instead (see below).

### Remote editing (stage 2)

- His board is stored in Firebase (a Google service), project `bro-board`. The site itself stays on GitHub Pages.
- His phone opens `…/bro-board/#b=<long random id>`, remembers the id, keeps a copy of the board and its recordings, and checks for changes when the app opens, when he returns to it, and every 5 minutes. It reads the board with plain web requests (`web/src/remote/rest.ts`), so his phone never loads the Firebase library. A board that fails the checks in `parseBoard` is ignored, and the last good copy is kept. A changed board is only swapped in on the first Home screen, so buttons never move part-way through a choice.
- The editor is at `…/bro-board/#edit` (`web/src/editor`). It uses Google sign-in and is only loaded on family's devices.
- When a phrase without a built-in recording is saved, the editor makes one in the browser with Kokoro (`kokoro-js`, voice am_puck, same speed and clean-up as `tools/make-audio.py`), encodes it as MP3 and stores it in the database. Recordings are named the same way as `tools/make-audio.py` names them.
- Who can read and write is set by `firebase/firestore.rules`. Boards can be read only by exact id; only emails listed in the database's `editors` collection can change anything. No email addresses or board ids are kept in this repository.

To try everything on your own computer without touching the real database (needs Java 21):

```bash
cd web
npm run emulators
```

Then, in a second terminal:

```bash
cd web
npm run dev:local
```

`npm run test:rules` checks the security rules against a local copy of Firebase. GitHub runs it on every pull request too. To publish changed rules, deploy `firebase/` with the Firebase CLI (`firebase deploy --only firestore`).

When a change is merged into `main`, GitHub tests it and publishes the site automatically.

## Build stages

1. Core board: categories, items, Speak and Show big
2. Remote editing by family
3. Texting hand-off to Messages

## Credits

The pictures on the buttons are from [Mulberry Symbols](https://mulberrysymbols.org/), copyright Steve Lee, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Some files were renamed; the pictures are unchanged. The licence text is in `web/public/symbols/LICENSE-mulberry.txt`. The typeface is [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/) from the Braille Institute, licensed under the SIL Open Font License 1.1 and bundled through [Fontsource](https://fontsource.org/). The voice recordings were made with [Kokoro](https://github.com/hexgrad/kokoro), an open-source voice model licensed Apache-2.0. The editor makes new recordings with [kokoro-js](https://www.npmjs.com/package/kokoro-js) (Apache-2.0) and encodes them with [lamejs](https://github.com/shijinyu/lamejs) (LGPL-3.0), which is used unchanged and loaded as its own file, only on the editor page.

Design ideas are informed by [Cboard](https://github.com/cboard-org/cboard); no Cboard code is used.

## Privacy

This repository contains no names, phone numbers, email addresses or health details of the person using the app. His board, the list of approved editors and (from stage 3) recipients' phone numbers live only in the Firebase database, protected by `firebase/firestore.rules`. His phone sends nothing back; the app keeps no record of what he asks for.
