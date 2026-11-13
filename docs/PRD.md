# Bro Board: Product Requirements (PRD)

Status: draft for family review. Nothing gets built until this is approved.

Background answers are in [interview-notes.md](interview-notes.md).

## 1. Problem

A man with Huntington's disease lives in an assisted living facility. Hand tremors and impaired speech make it hard for him to tell family and caregivers what he needs. Small needs go unmet or take a long time to work out, which is frustrating for him and for the people helping him.

## 2. Users

| User | What they need |
|---|---|
| **Him** (primary) | To express a basic need quickly, without speech and without precise touch |
| **Caregivers** at the facility | To hear or read exactly what he is asking for |
| **Family** | To receive his texts, and to change his buttons from far away |

## 3. Goals

1. He can express a common need in **three taps or fewer**.
2. Every button is large enough to hit with a tremor, and a stray touch does not send him somewhere confusing.
3. Family can add or change buttons without visiting.
4. Getting the app onto his phone takes one link and one "Add to Home screen" tap.

### Not goals for the first version

- Typing free-form messages
- Emergency alerting. This app does not replace the facility's call button.
- Building sentences from many symbols (what Cboard does)
- Message history, locking the phone into the app, an urgent help button (see section 12)

## 4. Screen flow

```
Home (categories)  ->  Items  ->  Message  ->  Speak
                                           ->  Show big
                                           ->  Text  ->  Pick person  ->  Yes / No  ->  Messages app opens
```

1. **Home.** Category buttons, such as "Food and drink" and "Bathroom".
2. **Items.** The specific needs in that category, such as "Going pee".
3. **Message.** The full phrase in large text ("I need to pee"), with three buttons:
   - **Speak**: the phone says the phrase aloud. Can be pressed again to repeat.
   - **Show big**: the phrase fills the screen in very large text and the screen stays on, so he can hold it up or leave it on a table.
   - **Text**: goes to step 4.
4. **Text.** He picks a person from big name buttons, confirms with Yes or No, and his Messages app opens with that person and the phrase already filled in. He taps Send there.

A category can also be a single message with no items (for example "Something else"), in which case tapping it goes straight to the Message screen. **Yes** and **No** go one step further: they are on the first page and speak the moment they are tapped, because they are the answers he needs most often and fastest.

## 5. Design rules for tremors

These apply to every screen.

| Rule | Detail |
|---|---|
| Few, large buttons | At most 6 per screen: 2 across, 3 down. They fill the screen. |
| No scrolling, no swiping | If there are more than 6 choices, the last button is "More" and leads to the next page. |
| Words plus pictures | Each button has a short label (1 to 3 words) and one picture. |
| Deliberate presses only | A button responds when the finger lifts while still on it. Sliding off cancels. |
| Ignore repeat taps | After a press, further taps are ignored for a short time (adjustable, about half a second to start) so one shaky press does not count twice. |
| Optional hold time | A setting that requires the finger to rest on a button briefly before it counts. Off to start; family can turn it on. |
| Fixed Back and Home | Large Back and Home buttons in the same place on every screen. |
| Clear feedback | The pressed button visibly changes, and the phone can say the label aloud (can be turned off). |
| Easy to read | High contrast, very large text, plain words. |
| Nothing to break | No pop-ups, no menus, no settings he can reach by accident. |

## 6. Starter button set (please correct this)

This is a first draft from the examples given. Family should change wording to match how he talks. Each item shows the button label, then what the phone says or texts.

**Page 1 of Home**

1. **Food and drink**
   - Hungry: "I am hungry."
   - Thirsty: "I would like a drink."
   - Snack: "I would like a snack."
   - Send snacks: "Please send me snacks."
   - Help eating: "I need help eating."
   - Finished: "I am finished eating."
2. **Bathroom**
   - Pee: "I need to pee."
   - Poo: "I need to poo."
   - Need help now: "I need help in the bathroom now."
   - Accident: "I had an accident and need help."
   - Shower: "I would like a shower."
3. **Pain**
   - Head: "I have pain in my head."
   - Mouth or teeth: "I have pain in my mouth."
   - Chest: "I have pain in my chest."
   - Stomach: "I have pain in my stomach."
   - Back: "I have pain in my back."
   - More: Arm or hand, Leg or foot, "I feel sick."
4. **Yes**: "Yes." Speaks with one tap.
5. **No**: "No." Speaks with one tap.
6. **More** (goes to page 2)

**Page 2 of Home**

1. **Clothes**
   - Pants: "Please help me put on pants."
   - Shirt: "Please help me put on a shirt."
   - Socks and shoes: "Please help me with socks and shoes."
   - Change clothes: "I want to change my clothes."
   - Take off: "Please help me take this off."
2. **TV and movies**
   - Put on a movie: "Please put on a movie."
   - Change it: "Please change what is on."
   - Louder: "Please turn it up."
   - Quieter: "Please turn it down."
   - Turn off: "Please turn the TV off."
3. **Comfort**
   - Too hot: "I am too hot."
   - Too cold: "I am too cold."
   - Move me: "Please help me change position."
   - Bed: "I want to go to bed."
   - Get up: "I want to get up."
   - Tired: "I am tired."
4. **People**
   - Call family: "I want to call my family."
   - Visit: "I would like a visit."
   - Be alone: "I would like to be alone for a while."
   - Talk: "I want to talk with someone."
5. **Something else**: "I need something that is not on my board. Please help me work out what."

## 7. Speech

- Every phrase on the board has a ready-made recording in a natural-sounding male voice. The recordings are part of the app, so they work without internet and sound the same on every phone.
- The recordings are made once with Kokoro, a free open-source voice model, using `tools/make-audio.py`.
- If a phrase has no recording, or the recording cannot play, the app uses the voice built into the phone.
- A phrase that family adds later uses the phone voice until a recording is made for it. Making that automatic is part of stage 2.

## 8. Texting

- A website is not allowed to send a text by itself. The app opens his Messages app with the person and the phrase filled in, and he taps Send.
- The text is sent from his own number, so recipients recognise it. It costs nothing beyond his phone plan.
- A Yes / No confirm comes before Messages opens, so a stray tap does not start a text.
- **Known risk:** the Send button in Messages is small. We will watch how he manages.
- **Fallback if he struggles:** a paid texting service (a few dollars a month) that sends with one tap. Those texts would come from a new number, not his. The app will be built so this can be added later without redoing the rest.

## 9. Remote editing by family

An editor page that approved family members sign in to. From any phone or computer they can:

- Add, rename, reorder and remove categories and items
- Change the phrase that is spoken or texted
- Choose the picture for a button
- Add and remove text recipients (name and phone number)
- Adjust touch settings (repeat-tap delay, hold time, spoken labels on or off)

Changes appear on his phone automatically the next time it has internet. His phone keeps the last copy, so the board still works offline.

## 10. Installing and updating

1. Family texts him the app link.
2. He or a caregiver opens it in Chrome and taps **Add to Home screen**.
3. The app gets its own icon and opens full screen.

Updates to the app arrive automatically. Nobody has to reinstall anything.

## 11. Privacy

- The code repository is private and contains no names, phone numbers or health details.
- The board contents and recipients' phone numbers are stored in a private online database (Firebase, a Google service). Only approved family accounts can change them.
- His phone opens the board through a private link that is long and unguessable. The link should not be shared outside family and caregivers.
- The app keeps no record of what he asks for in the first version.

## 12. Later ideas (not in the first version)

- One-tap texting service (the fallback in section 8)
- Urgent help button on every screen
- Message history, so family can spot patterns such as frequent pain
- Using family photos as button pictures
- Keeping the phone locked into the app

## 13. Comparison with Cboard

[Cboard](https://github.com/cboard-org/cboard) is a free, open-source communication board web app and the closest existing product.

| | Cboard | Bro Board |
|---|---|---|
| Main idea | Build sentences from many picture tiles | Pick one ready-made need |
| Buttons per screen | Many, small on a phone | At most 6, filling the screen |
| Output | Speaks | Speaks, shows big, or texts |
| Texting | No | Yes, through his Messages app |
| Editing | On the device, or with a Cboard account | Remotely by family |
| Tremor safeguards | Limited | Built in from the start |

**What we borrow:** the grid-of-tiles idea, folders for categories, a label plus picture on each tile, a spoken phrase that can differ from the label, and the Mulberry picture set (free with credit, licence CC BY-SA 4.0).

**What we do not borrow:** Cboard's code. Its licence (GPL-3.0) would require this whole app to use the same licence, and it does much more than he needs.

**Suggested experiment:** have him try app.cboard.io on his phone for a few minutes. Note what he manages and where he struggles, and add it here.

## 14. Build stages

| Stage | What he gets | What family gets |
|---|---|---|
| 1. Core board | Categories, items, Speak, Show big, installable from a link, works offline | A link to try on their own phones |
| 2. Remote editing | Board updates itself | Editor page with sign-in |
| 3. Texting | Text button, person picker, confirm, hand-off to Messages | Recipients managed in the editor |

## 15. How we will know it works

- He can find and send a common need in three taps or fewer, without help, after a short introduction.
- Caregivers understand the spoken or shown message the first time.
- He uses it without being prompted.
- Family can change a button remotely and see it on his phone.

## 16. Open questions for family

1. Is the starter button set in section 6 right? What is missing, and what wording would he use?
2. Who should be on the text recipient list?
3. Does the facility have a phone number that staff actually check for texts?
4. Who can help him once with the "Add to Home screen" step?
5. Is his phone's volume loud enough to be heard in his room, or would a small speaker help?
6. Has he tried Cboard, and how did it go?
