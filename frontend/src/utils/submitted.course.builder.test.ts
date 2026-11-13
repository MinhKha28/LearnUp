import { describe, expect, it } from "vitest";
import { isBuilderMutationPath } from "./submitted.course.builder";

const base = "/instructor/courses/course-1/builder";

describe("BR-83 submitted Course Builder route guard", () => {
  it.each([
    "new-version",
    "structure/edit",
    "modules/new",
    "modules/module-1/lessons/new",
    "modules/module-1/delete",
    "lessons/lesson-1/delete",
    "lessons/lesson-1/content/edit",
    "lessons/lesson-1/materials/video/new",
    "lessons/lesson-1/materials/reading/new",
    "lessons/lesson-1/materials/material-1/edit",
    "lessons/lesson-1/materials/material-1/delete",
    "quizzes/new",
    "quizzes/quiz-1/edit",
    "quizzes/quiz-1/delete",
    "quizzes/quiz-1/questions/new",
    "quizzes/quiz-1/questions/question-1/edit",
    "assignments/new",
    "assignments/assignment-1/edit",
    "assignments/assignment-1/delete",
    "assignments/assignment-1/rubric",
    "assignments/assignment-1/peer-review",
  ])("blocks mutation route %s", (route) => {
    expect(isBuilderMutationPath(`${base}/${route}`)).toBe(true);
  });

  it.each([
    "",
    "quizzes",
    "quizzes/quiz-1",
    "assignments",
    "assignments/assignment-1",
    "assignments/assignment-1/peer-cycles",
    "lessons/lesson-1",
    "lessons/lesson-1/materials",
  ])("keeps the read route %s accessible", (route) => {
    expect(isBuilderMutationPath(route ? `${base}/${route}` : base)).toBe(false);
  });
});
