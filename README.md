# Bro Board

A simple web app with big buttons that helps a person with Huntington's disease tell family and caregivers what he needs, without relying on speech or precise touch.

He picks a category (for example "Bathroom"), then a specific need ("Going pee"), then chooses how to say it:

- **Speak**: the phone says it aloud
- **Show big**: the message fills the screen
- **Text**: his Messages app opens with a person and the message already filled in

Family can change the buttons remotely from their own phone or computer.

## Status

Stage 1 is built: categories, items, Speak and Show big. Remote editing (stage 2) and texting (stage 3) come next.

- [Product requirements (PRD)](docs/PRD.md): what the app must do and why
- [Interview notes](docs/interview-notes.md): the answers the PRD is based on

## How it will get onto his phone

1. Someone texts him the app link.
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

The starter buttons are in `web/src/data/default-board.json`. Each button has a short label, a picture name from `web/public/symbols`, and the phrase that is spoken or shown.

Each phrase also has a voice recording in `web/public/audio`. After changing or adding a phrase, run `tools/make-audio.py` again (instructions are at the top of that file) to make the missing recordings. The tests fail if a phrase has no recording.

When a change is merged into `main`, GitHub tests it and publishes the site automatically.

## Build stages

1. Core board: categories, items, Speak and Show big
2. Remote editing by family
3. Texting hand-off to Messages

## Credits

The pictures on the buttons are from [Mulberry Symbols](https://mulberrysymbols.org/), copyright Steve Lee, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Some files were renamed; the pictures are unchanged. The licence text is in `web/public/symbols/LICENSE-mulberry.txt`. The voice recordings were made with [Kokoro](https://github.com/hexgrad/kokoro), an open-source voice model licensed Apache-2.0.

Design ideas are informed by [Cboard](https://github.com/cboard-org/cboard); no Cboard code is used.

## Privacy

This repository contains no names, phone numbers or health details of the person using the app. Those live only in the app's private storage.
