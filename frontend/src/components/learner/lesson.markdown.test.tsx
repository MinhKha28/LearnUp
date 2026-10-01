import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LessonMarkdown } from "@/components/learner/lesson.markdown";

const render = (content: string) => renderToStaticMarkup(<LessonMarkdown content={content} />);

describe("LessonMarkdown (D42)", () => {
  it("không thực thi script", () => {
    expect(render("<script>alert(1)</script>")).not.toContain("<script");
  });

  it("bỏ thẻ img thô có onerror", () => {
    const html = render("<img src=x onerror=alert(1)>");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<img");
  });

  it("chặn liên kết javascript:", () => {
    expect(render("[bấm](javascript:alert(1))")).not.toContain("javascript:");
  });

  it("bỏ onclick trong thẻ a thô", () => {
    expect(render('<a href="https://a.vn" onclick="alert(1)">x</a>')).not.toContain("onclick");
  });

  it("bỏ iframe", () => {
    expect(render('<iframe src="https://evil.vn"></iframe>')).not.toContain("<iframe");
  });

  it("ảnh không phải https không được render", () => {
    expect(render("![a](http://evil.vn/x.png)")).not.toContain("<img");
    expect(render("![a](data:image/png;base64,AAA)")).not.toContain("<img");
  });

  it("ảnh không render vẫn hiện alt dạng chữ", () => {
    expect(render("![sơ đồ](http://evil.vn/x.png)")).toContain("sơ đồ");
  });

  it("ảnh https có referrerpolicy no-referrer và lazy", () => {
    const html = render("![a](https://ok.vn/x.png)");
    expect(html).toContain("<img");
    expect(html.toLowerCase()).toContain('referrerpolicy="no-referrer"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt="a"');
  });

  it("liên kết ngoài mở tab mới với rel an toàn", () => {
    const html = render("[ngoài](https://ok.vn)");
    expect(html).toContain('target="_blank"');
    const rel = /rel="([^"]*)"/.exec(html)?.[1].split(" ") ?? [];
    expect(rel).toEqual(expect.arrayContaining(["noopener", "noreferrer", "nofollow"]));
  });

  it("liên kết tương đối không có target", () => {
    const html = render("[trong](/learner/courses)");
    expect(html).toContain('href="/learner/courses"');
    expect(html).not.toContain("target=");
  });

  it("bảng GFM được bọc trong khung cuộn", () => {
    const html = render("| a | b |\n| - | - |\n| 1 | 2 |");
    expect(html).toContain("<table");
    expect(html).toContain('class="lesson-markdown-table"');
  });

  it("chuỗi rỗng không lỗi", () => {
    expect(() => render("")).not.toThrow();
  });
});
