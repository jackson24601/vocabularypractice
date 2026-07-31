# WordNest

A simple web app that helps teachers create vocabulary practice sets for students.

## Teacher page

Teachers can:

- Name a vocabulary set
- Set a practice due date
- Enter an email address for student completion reports
- Add 4–10 terms and definitions
- Copy a shareable student practice link

## Student practice

Students open the shared link, enter their school email, and begin a timed matching practice:

1. A definition appears for 3 seconds
2. Four term choices appear
3. Students select the matching term
4. Score and correct-count stay visible throughout

Practice is complete when the student:

- Practices for the full 10 minutes
- Scores 75% or higher
- Gets at least 50 correct matches

Sets travel in the student link itself, so teachers can share the URL directly.

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

For quicker local testing of the practice timer, append `&fast=1` to a student link (20s session).

## Build

```bash
npm run build
npm run preview
```

For a production build meant for GitHub Pages:

```bash
VITE_BASE=/vocabularypractice/ npm run build
```
