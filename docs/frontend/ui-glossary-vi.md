# Vietnamese UI glossary

The words that the Vietnamese screens use for the terms of the business documents, so that every page says the same
thing. The business documents (`docs/source-of-truth/`) keep the English terms (Learner, Assignment...); this list is for
what a user reads on the screen. Code, API fields, status values and comments stay in English.

## Terms

| In the documents and the code | On the screen | Notes |
| --- | --- | --- |
| Learner | học viên | lower case inside a sentence, "Học viên" at the start of a label or a cell |
| Instructor | giảng viên | |
| Organizer | quản lý đào tạo | the name the pages already use |
| Course | khóa học | "Khóa học của tôi" is the name of the menu, so it keeps its capital letter |
| Module (of a Course) | chương | a Course reads "Khóa học → Chương → Bài học": "Chương 01", not "Module 01" |
| Lesson | bài học | |
| Assignment | bài tập | |
| Quiz | bài trắc nghiệm | |
| Assessment (Quiz or Assignment) | bài đánh giá | |
| Submission | bài nộp | |
| Peer review | chấm chéo | |
| Cycle (of peer review) | chu kỳ | |
| Rubric | tiêu chí chấm | a Rubric is a list of criteria: say "tiêu chí chấm", not "Rubric" |
| Criterion | tiêu chí | |
| Attempt (of a Quiz) | lượt làm | |
| Passing score | điểm đạt | |
| Grade / Finalize | chấm điểm / chốt điểm | |

Not decided yet (the pages keep what they have until it is): Enrollment ("lượt đăng ký học" is proposed).

## Rules

- **Sentence case.** No text in capitals, not even the small line above a title: "Bài nộp / Chấm điểm", not
  "BÀI NỘP / CHẤM ĐIỂM".
- **No English term in a Vietnamese sentence** when the table has a word for it: "Bài tập này chưa có tiêu chí chấm", not
  "Assignment này chưa có tiêu chí Rubric".
- **Dates and times** come from `formatDateVN` (date) and `formatDateTimeVN` (date and time) in `src/utils/helper.ts`:
  `dd/MM/yyyy` and `dd/MM/yyyy HH:mm`, date first, 24-hour clock, Vietnam time (UTC+7) whatever the time zone of the
  browser. Do not use `toLocaleString("vi-VN")` for this: it gives `14:03:18 7/11/2026` in the time zone of the
  browser.
- **Scores** use a comma for the decimals (`66,67`).
- A person without a name is "Học viên" followed by the last four characters of the id, in capitals (`Học viên 00AB`).
