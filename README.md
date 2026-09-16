# WordNest

A simple web app that helps teachers create vocabulary practice sets for students.

## Teacher page

Teachers can:

- Name a vocabulary set
- Set a practice due date and time
- Enter an email address for student scores
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

Student results are emailed **as they finish** to the address entered on the create form (via [FormSubmit](https://formsubmit.co/)). Creating a set also sends a short confirmation so a new inbox can click FormSubmit’s one-time activation link before class.

When live class-report storage is available, scores are still saved to the class report page. If that storage cannot be reached from the browser (GitHub Pages cannot call jsonhosting.com directly because of CORS), WordNest still creates the practice set and emails each score.

The first email to a new teacher address may require clicking an activation link FormSubmit sends to that inbox.

New practice sessions cannot start after the due time.

Sets travel in the student and class-report links themselves, so teachers can share those URLs directly. The set is packed into a short compressed code in the link (`?s=`). Older `?set=` links still open.

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

For quicker local testing of the practice timer, append `&fast=1` to a student link (20s session, 4s answer window). `npm run dev` proxies class-report storage so the live class report page works locally. Scores are emailed to the report address as students finish in both local and GitHub Pages use.

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
