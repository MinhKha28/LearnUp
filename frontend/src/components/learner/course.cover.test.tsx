import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CourseCover } from "./course.cover";

describe("CourseCover", () => {
  it.each([
    ["[SEED] Khóa học an toàn", "K"],
    ["  [SEED] [DEMO] — Đào tạo", "Đ"],
    ["[SEED] !!! 2026", "2"],
    ["  ... học tập", "H"],
    ["普通课程", "普"],
  ])("uses a meaningful initial for %s", (name, initial) => {
    expect(renderToStaticMarkup(<CourseCover name={name} />)).toContain(
      `<span class="course-cover-initial">${initial}</span>`,
    );
  });
  it.each(["", "[SEED] ...", "[SEED] [DEMO] !!!"])("uses the default icon for %s", (name) => {
    const html = renderToStaticMarkup(<CourseCover name={name} />);
    expect(html).not.toContain("course-cover-initial");
    expect(html).toContain("svg");
  });
});
