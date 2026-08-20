# AWS Cloud Practitioner Practice Quiz

A local quiz app generated from the `practice-exam` folder in the provided `AWS-Certified-Cloud-Practitioner-Notes` repository.

## Features

- 1,142 questions across 23 practice exams
- Single-answer and multiple-answer questions (264 Choose Two and 3 Choose Three)
- “Choose two” / “Choose three” validation: the full required answer set must match to receive credit
- Immediate correct/incorrect feedback in Practice mode
- Correct answer shown after checking in Practice mode
- Test simulation mode with either a 100-minute or 130-minute countdown timer
- Simulation mode hides score/feedback until the test is submitted or time expires
- 10, 25, 50, 65, or full-length quiz sessions
- Original or shuffled question order
- Review-incorrect mode
- Local progress saving
- Click the AWS Practice Quiz header to return Home without losing the active quiz; use Resume quiz to continue
- Reset this quiz discards the active session and returns to quiz selection
- Mobile-friendly review navigation with Continue test available at the bottom of the review list
- Light/dark theme toggle

## Run locally

Double-click `index.html` to open the quiz.

If local-file restrictions prevent it from opening correctly, open a terminal in this folder and run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Review incorrect behavior
In Practice mode, **Review incorrect** opens a summary of every checked question answered incorrectly so far. Each entry shows the selected answer and the correct answer. **Continue test** returns to the same question and keeps the current quiz progress intact.
