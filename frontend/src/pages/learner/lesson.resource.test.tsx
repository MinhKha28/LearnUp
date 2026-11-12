// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import LessonResource from "./lesson.resource";

const playback = vi.hoisted(() => ({
  title: "Video kiểm tra", playbackUrl: "/fixture.mp4",
  watchedSeconds: 1, requiredSeconds: 20, durationSeconds: 30, completed: false, heartbeatSeconds: 10,
}));

vi.mock("@/services/learning.service", () => ({
  fetchVideoPlayback: vi.fn(),
  fetchLessonDetail: vi.fn(),
  fetchCurriculum: vi.fn(),
  fetchReadingAccess: vi.fn(),
  completeReading: vi.fn(),
}));
vi.mock("@/components/context/app.context", () => ({ useCurrentApp: vi.fn() }));
vi.mock("@/hooks/use.api.query", () => ({
  useApiQuery: (_fetch: unknown, deps: string[]) => ({
    status: "success",
    data: deps[1] === "l"
      ? { materials: [{ materialId: "v", materialType: "Video" }] }
      : playback,
  }),
}));
vi.mock("@/hooks/useVideoProgress", () => ({
  useVideoProgress: () => ({ progress: playback, events: {} }),
}));
vi.mock("@/hooks/use.learning.refresh", () => ({ useLearningRefresh: vi.fn() }));

afterEach(cleanup);

it("identifies the video progress tag without adding a course status", () => {
  render(
    <MemoryRouter initialEntries={["/courses/e/lessons/l/resources/v"]}>
      <Routes>
        <Route path="/courses/:enrollmentId/lessons/:lessonId/resources/:resourceId" element={<LessonResource />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText("Video: Chưa đủ thời lượng")).toBeTruthy();
  expect(screen.queryByText(/^Khóa học:/)).toBeNull();
});
