# WordNest

A simple web app that helps teachers create vocabulary practice sets for students.

## Teacher page

Teachers can:

- Name a vocabulary set
- Set a practice due date and time
- Enter an email address for the class report
- Add 4–50 terms and definitions, or upload a CSV
- Copy a shareable student practice link
- Bookmark a class report page

## Student practice

Students open the shared link, enter their name, and begin a timed matching practice:

1. A definition appears for 3 seconds
2. Four term choices appear
3. Students have 15 seconds to select the matching term. No answer in that window counts as incorrect.
4. Score and correct-count stay visible throughout

Practice ends after ten minutes. There is no passing score. Students can take the practice as many times as they want before the due time; every attempt is saved.

Student results are saved as they finish. WordNest does **not** email the teacher after each student. When the due date and time have passed, WordNest emails **one class report** listing each student’s name and every score (via [FormSubmit](https://formsubmit.co/)). The first report to a new teacher email may require clicking an activation link FormSubmit sends to that inbox.

Leave the class report page open until the due time, or reopen it after the deadline. If a student opens the practice link after the window closes, that also tries to send the class report.

New practice sessions cannot start after the due time.

Sets travel in the student and class-report links themselves, so teachers can share those URLs directly.

## Live site

GitHub Pages: https://jackson24601.github.io/vocabularypractice/

Asset paths are relative so the app works from that project subdirectory.

## Develop

```bash
npm install
npm run dev
```

- Teacher page: `http://localhost:5173/`
- Student page needs a generated link from the teacher success screen
- Class report page is the second link on the success screen

For quicker local testing of the practice timer, append `&fast=1` to a student link (20s session, 4s answer window). To test the class report email, set the due time a minute or two ahead and leave the class report page open.

```bash
npm test
```

## Build

```bash
npm run build
npm run preview
```

For a production build meant for GitHub Pages:

```bash
VITE_BASE=/vocabularypractice/ npm run build
```
