# Changing his board (for family)

Family can change his buttons from any computer or phone. His phone picks up the change by itself within a few minutes, the next time it has internet. It keeps the last copy, so the board still works with no internet.

## Opening the editor

Go to **https://walmerz-personal.github.io/bro-board/#edit** and tap **Sign in with Google**.

Only Google accounts on the approved list can make changes. Anyone else sees "This account isn't on the list yet" and can't change anything.

## What you can change

On a computer, **His phone** on the left shows exactly what his screens will look like, and changes as you edit. Tap a button there, or **Edit** in the list, to open it.

- **Home screen buttons**: rename, add, change the picture and the **colour**, and move them with **Up** and **Down** or take them off with **Remove**. The list is grouped by the screen each button appears on.
- **What a button does**: either it **opens a list of needs**, or it **says one message**. A message button can also **speak straight away with one tap and stay on Home**, like Yes and No.
- **Needs inside a button**: the label, the picture, and **what the phone says**. They take the colour of the button they are in, so he can tell where he is.
- **Touch and sound**: how long repeat taps are ignored, an optional hold time, the phone voice's speed, a gentle buzz when a press counts, whether button names are said aloud, and **Little animations**: a tick that draws itself, a soft glow when something is said, the speaker's sound waves moving while it speaks, a paper plane when a text is sent, gentle fades between screens and springy buttons. Each lasts under half a second and only follows his own tap. Turn it off if it seems to distract him; his phone's own "reduce motion" setting turns it off too.

The editor protects the rules that make the board usable with tremors:

- **Labels can have at most 3 words.** Save stays off until every label fits.
- **At most 6 buttons per screen, with no scrolling.** His phone always splits longer lists into screens of 5 plus a **More** button. The editor warns you when a list needs a More page, because that costs him an extra tap.
- **Yes, No and other one-tap buttons** should stay on the first Home screen. The editor warns you if one moves off it.

Press **Save changes** when you're done. **Undo changes** throws away anything you haven't saved. **Earlier versions** keeps the last 10 saves, so you can bring an old one back and save it again.

## People he can text

In the **People he can text** section, add each person with:

- **Name on his button**: 3 words or fewer, for example "Mum" or "Nurse station".
- **Mobile number**: type it the usual way, for example `(555) 212-3456`. US and Canada numbers need all 10 digits; for another country start with `+` and the country code. The editor shows where texts will go, and Save stays off until the number is complete.
- **Picture**: tap **Change picture** to choose one for his button.

When at least one person is listed, his message screen gets a purple **Text** button. He picks a person, sees "Send this text?" with big **Yes, text** and **No** buttons, and Yes opens his Messages app with the person and the words filled in, for example "I am hungry. (sent from Bro Board)". He taps Send there; the text comes from his own number. When he comes back, Bro Board is on its Home screen.

Anyone with his private link could see the names and numbers on this list, the same as his buttons, so keep the link to family and caregivers.

## Voice recordings

When you save a new or changed phrase, the editor makes a natural voice recording for it (the same voice as the rest of the board) and sends it to his phone. Keep the editor open until it says the recordings are ready.

- The first time on each computer, the editor downloads the voice (about 90 MB). After that it takes a few seconds per phrase.
- Until a recording is ready, his phone says the new phrase with its own built-in voice.
- A computer works best. Recent phones work too, but more slowly.

## His private link

The editor's **Open it on his phone** section shows his private link, a long web address ending in `#b=` and a random code.

1. Open the link on his phone in Chrome.
2. Tap the **⋮** menu, then **Add to Home screen**.
3. From then on, he opens Bro Board from its icon on his Home screen.

Anyone with the link can **see** his board, though nobody can change it without being an approved editor. Share it only with family and caregivers. If it has been shared too widely, use **Make a new link** in the editor's **Privacy** section. The old link stops working straight away, and you then need to open the new link on his phone and add it to the Home screen again.

## Adding or removing an approved editor

This is done in the Firebase console, not in the editor, so nobody can add themselves.

1. Go to **https://console.firebase.google.com/project/bro-board/firestore/databases/-default-/data** and sign in with the Google account that owns the Bro Board project.
2. **To add someone:**
   1. Click the **editors** collection. If it doesn't exist yet, click **+ Start collection** and type `editors` as the Collection ID.
   2. Click **+ Add document**.
   3. For **Document ID**, type the person's Google email address exactly, **in lowercase**, for example `someone@gmail.com`.
   4. Leave the fields empty (if it insists on one, add a field `added` of type boolean set to `true`), then click **Save**.
3. **To remove someone:** click their email under **editors**, then use the **⋮** menu → **Delete document**.

The change takes effect the next time they open or reload the editor.

The list of editors lives only in the database. It is never written into the code, which is public.
