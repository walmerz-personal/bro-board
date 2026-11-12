# Bro Board

A simple web app with big buttons that helps a person with Huntington's disease tell family and caregivers what he needs, without relying on speech or precise touch.

He picks a category (for example "Bathroom"), then a specific need ("Going pee"), then chooses how to say it:

- **Speak**: the phone says it aloud
- **Show big**: the message fills the screen
- **Text**: his Messages app opens with a person and the message already filled in

Family can change the buttons remotely from their own phone or computer.

## Status

Planning. No app code yet.

- [Product requirements (PRD)](docs/PRD.md): what the app must do and why
- [Interview notes](docs/interview-notes.md): the answers the PRD is based on

## How it will get onto his phone

1. Someone texts him the app link.
2. He or a caregiver opens it in Chrome and taps **Add to Home screen**.
3. The app then has its own icon and opens full screen. Updates arrive automatically.

## Build stages

1. Core board: categories, items, Speak and Show big
2. Remote editing by family
3. Texting hand-off to Messages

## Credits

Pictures will come from the [Mulberry Symbols](https://mulberrysymbols.org/) set, licensed CC BY-SA 4.0. Design ideas are informed by [Cboard](https://github.com/cboard-org/cboard); no Cboard code is used.

## Privacy

This repository contains no names, phone numbers or health details of the person using the app. Those live only in the app's private storage.
