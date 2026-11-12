# Interview notes

Answers given by the family member who is organising the project. Recorded 2026-11-12.

## The person using the app

- Has Huntington's disease, lives in an assisted living facility
- Hand tremors and impaired speech make it hard to communicate with family and caregivers
- Can reliably tap large buttons (about the size of a playing card), with occasional mistakes
- Can read, but it should be kept simple: short words plus pictures, at most two menu levels

## Device and connection

- His own Android phone
- Has a cell plan that can send regular text messages
- Internet where he lives is reliable

## What should happen when he picks a message

He chooses each time between:

1. Speak it aloud
2. Show it large on the screen
3. Text it to a person he picks (family members or a facility staff number)

## Decisions

| Question | Decision | Reason |
|---|---|---|
| Web app or Android app | Web app | Family does not live nearby. A link is far easier to install than an Android app file, and updates arrive automatically. |
| How texting works | Open his Messages app with the person and message filled in; he taps Send | Free and sent from his own number. A website cannot send a text by itself. |
| Who receives texts | He picks a person each time | |
| Editing buttons | Remotely, from a family member's phone or computer | Family does not live nearby |
| Safeguards in the first version | A Yes / No confirm before a text is prepared | Prevents accidental texts from tremors |

## Left out of the first version on purpose

- Urgent help button
- Locking the phone into the app
- Message history

## Known risk

The Send button in the Messages app is small. If he struggles with it, the fallback is a paid texting service (a few dollars a month) that sends with one tap from a new number.

## Comparable product

Cboard (https://github.com/cboard-org/cboard), a free open-source communication board. Used as a design reference and as the source of the Mulberry picture set. Suggested experiment: have him try app.cboard.io for a few minutes and note what he manages and what he struggles with.
