// @vitest-environment jsdom
// UC31.1: the Learner gives a review against the Rubric, by interaction. jsdom is for this file only.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { message } from "antd";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/services/axios.customize", () => ({
  assessmentAxios: {},
  default: {},
}));
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  fetchLearnerPeerReviewAPI: vi.fn(),
  giveLearnerPeerReviewAPI: vi.fn(),
  downloadLearnerReviewFileAPI: vi.fn(),
  downloadLearnerPromptFileAPI: vi.fn(),
}));

import * as api from "@/services/assessment.service";
import PeerReviewForm from "./peer.review.form";

const detail = (over: Record<string, unknown> = {}) => ({
  statusCode: 200,
  data: {
    id: "review-1",
    assignmentId: "assignment-1",
    assignmentTitle: "Essay",
    courseId: "course-1",
    status: "Pending",
    state: "Open",
    reviewDueAt: "2026-11-10T10:00:00Z",
    completedAt: null,
    score: null,
    assignment: {
      prompt: "Write about peer review",
      promptFileUrl: null,
      promptFileName: null,
      rubric: [
        {
          id: "c1",
          name: "Argument",
          description: "Is it argued?",
          maxPoints: 10,
          position: 0,
        },
        {
          id: "c2",
          name: "Style",
          description: null,
          maxPoints: 5,
          position: 1,
        },
      ],
    },
    submission: {
      content: "My <b>essay</b>",
      file: {
        fileName: "submitted-work.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        url: "/x",
      },
    },
    myReview: null,
    ...over,
  },
});

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/learner/peer-review/review-1"]}>
      <Routes>
        <Route
          path="/learner/peer-review/:reviewId"
          element={<PeerReviewForm />}
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const fill = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(`Score for ${name}`), {
    target: { value },
  });
const writeComment = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText("Write specific feedback..."), {
    target: { value: text },
  });
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList);
});
beforeEach(() => {
  vi.mocked(api.fetchLearnerPeerReviewAPI).mockResolvedValue(detail() as never);
});
afterEach(() => {
  cleanup();
  message.destroy();
  vi.clearAllMocks();
});

describe("UC31.1 giving a review", () => {
  it("shows the work without its author, the Rubric with each maximum, and sends nothing until submitted", async () => {
    renderPage();
    await screen.findByText("Review: Essay");
    expect(screen.getByText("Author hidden")).toBeTruthy();
    expect(screen.getByText("My <b>essay</b>")).toBeTruthy(); // text, not markup
    expect(screen.getByText("Argument (0 to 10)")).toBeTruthy();
    expect(screen.getByText("Style (0 to 5)")).toBeTruthy();
    expect(screen.getByText("Is it argued?")).toBeTruthy();
    expect(
      screen.getByText(/Download submitted work \(submitted-work\.pdf\)/),
    ).toBeTruthy();
    expect(api.giveLearnerPeerReviewAPI).not.toHaveBeenCalled();
  });

  it("asks the review by the id in the address", async () => {
    renderPage();
    await screen.findByText("Review: Essay");
    expect(api.fetchLearnerPeerReviewAPI).toHaveBeenCalledWith("review-1");
  });

  it("does not send a review with a criterion left out or without a comment (BR-257)", async () => {
    renderPage();
    await screen.findByText("Review: Essay");
    fill("Argument", "7");
    writeComment("Good.");
    submit();
    await screen.findByText(
      "Give a score for every criterion before submitting.",
    );
    fill("Style", "4");
    writeComment("   ");
    submit();
    await screen.findByText("Write a general comment before submitting.");
    expect(api.giveLearnerPeerReviewAPI).not.toHaveBeenCalled();
  });

  it("sends a score for every criterion and the comment, tells the Learner and goes back to the queue", async () => {
    vi.mocked(api.giveLearnerPeerReviewAPI).mockResolvedValue({
      statusCode: 200,
      data: {
        id: "review-1",
        status: "Completed",
        score: 73.33,
        completedAt: "x",
        remainingInAssignment: 1,
      },
    } as never);
    renderPage();
    await screen.findByText("Review: Essay");
    fill("Argument", "7");
    fill("Style", "4");
    writeComment("  Clear and well argued.  ");
    submit();
    await screen.findByText("Review submitted.");
    expect(api.giveLearnerPeerReviewAPI).toHaveBeenCalledWith("review-1", {
      scores: [
        { criterionId: "c1", points: 7 },
        { criterionId: "c2", points: 4 },
      ],
      comment: "Clear and well argued.",
    });
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(
        "/learner/peer-review",
      ),
    );
  });

  it("a second press while it is saving sends one request only", async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.giveLearnerPeerReviewAPI).mockReturnValue(
      new Promise((resolve) => (finish = resolve)) as never,
    );
    renderPage();
    await screen.findByText("Review: Essay");
    fill("Argument", "7");
    fill("Style", "4");
    writeComment("Fine.");
    const button = screen.getByRole("button", { name: "Submit review" });
    fireEvent.click(button);
    fireEvent.click(button); // the button now says it is loading, so it is the same element that is pressed again
    expect(api.giveLearnerPeerReviewAPI).toHaveBeenCalledTimes(1);
    finish({
      statusCode: 200,
      data: {
        id: "review-1",
        status: "Completed",
        score: 1,
        completedAt: "x",
        remainingInAssignment: 0,
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(
        "/learner/peer-review",
      ),
    );
  });

  it("a review that was given meanwhile says so and shows it as given", async () => {
    vi.mocked(api.giveLearnerPeerReviewAPI).mockResolvedValue({
      statusCode: 409,
      error: { code: "REVIEW_ALREADY_GIVEN", message: "x" },
    } as never);
    vi.mocked(api.fetchLearnerPeerReviewAPI)
      .mockResolvedValueOnce(detail() as never)
      .mockResolvedValue(
        detail({
          state: "Done",
          status: "Completed",
          completedAt: "2026-11-02T10:00:00Z",
          score: 80,
          myReview: {
            comment: "Given before.",
            scores: [
              { criterionId: "c1", points: 8 },
              { criterionId: "c2", points: 4 },
            ],
          },
        }) as never,
      );
    renderPage();
    await screen.findByText("Review: Essay");
    fill("Argument", "7");
    fill("Style", "4");
    writeComment("Fine.");
    submit();
    await screen.findByText("This review was already given.");
    await screen.findByText(/This review can no longer be edited\./);
    expect(screen.queryByRole("button", { name: "Submit review" })).toBeNull();
  });

  it("a deadline that passed meanwhile says so and closes the form", async () => {
    vi.mocked(api.giveLearnerPeerReviewAPI).mockResolvedValue({
      statusCode: 409,
      error: { code: "REVIEW_CLOSED", message: "x" },
    } as never);
    vi.mocked(api.fetchLearnerPeerReviewAPI)
      .mockResolvedValueOnce(detail() as never)
      .mockResolvedValue(detail({ state: "Closed" }) as never);
    renderPage();
    await screen.findByText("Review: Essay");
    fill("Argument", "7");
    fill("Style", "4");
    writeComment("Fine.");
    submit();
    await screen.findByText(
      "The deadline of this review has passed, so it can no longer be given.",
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Submit review" }),
      ).toBeNull(),
    );
  });

  it("shows what the server refused in a review it did not accept", async () => {
    vi.mocked(api.giveLearnerPeerReviewAPI).mockResolvedValue({
      statusCode: 400,
      error: {
        code: "RUBRIC_SCORE_OUT_OF_RANGE",
        message: "A criterion score cannot exceed 10 points.",
      },
    } as never);
    renderPage();
    await screen.findByText("Review: Essay");
    fill("Argument", "7");
    fill("Style", "4");
    writeComment("Fine.");
    submit();
    await screen.findByText("A criterion score cannot exceed 10 points.");
    expect(screen.getByRole("button", { name: "Submit review" })).toBeTruthy();
  });

  it("says the service cannot be reached and keeps what was typed", async () => {
    vi.mocked(api.giveLearnerPeerReviewAPI).mockRejectedValue(
      new Error("network"),
    );
    renderPage();
    await screen.findByText("Review: Essay");
    fill("Argument", "7");
    fill("Style", "4");
    writeComment("Fine.");
    submit();
    await screen.findByText(
      "Unable to reach the Assessment service. Please try again.",
    );
    expect(
      (
        screen.getByPlaceholderText(
          "Write specific feedback...",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("Fine.");
  });
});

describe("UC31 reading a review that is done or closed", () => {
  it("a given review is read-only, with the scores, the comment and the score it was given", async () => {
    vi.mocked(api.fetchLearnerPeerReviewAPI).mockResolvedValue(
      detail({
        state: "Done",
        status: "Completed",
        completedAt: "2026-11-02T10:00:00Z",
        score: 80,
        myReview: {
          comment: "Given before.",
          scores: [
            { criterionId: "c1", points: 8 },
            { criterionId: "c2", points: 4 },
          ],
        },
      }) as never,
    );
    renderPage();
    await screen.findByText(/This review can no longer be edited\./);
    expect(screen.getByText(/score 80 \/ 100/)).toBeTruthy();
    expect(
      (screen.getByLabelText("Score for Argument") as HTMLInputElement).value,
    ).toBe("8");
    expect(
      (screen.getByLabelText("Score for Argument") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByPlaceholderText(
          "Write specific feedback...",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("Given before.");
    expect(screen.queryByRole("button", { name: "Submit review" })).toBeNull();
  });

  it("a closed review says the Instructor grades it and offers no submit", async () => {
    vi.mocked(api.fetchLearnerPeerReviewAPI).mockResolvedValue(
      detail({ state: "Closed", status: "Missed" }) as never,
    );
    renderPage();
    await screen.findByText(/The Instructor grades the submission\./);
    expect(screen.queryByRole("button", { name: "Submit review" })).toBeNull();
  });

  it("a review that is not found, or is not the Learner's, says so with a way back", async () => {
    vi.mocked(api.fetchLearnerPeerReviewAPI).mockResolvedValue({
      statusCode: 404,
      error: { code: "REVIEW_NOT_FOUND", message: "x" },
    } as never);
    renderPage();
    await screen.findByText(
      "This review may have been removed, or it is not yours.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Back to Peer Review" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(
        "/learner/peer-review",
      ),
    );
  });

  it("the work can be downloaded under the neutral name, and a failed download says so", async () => {
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.mocked(api.downloadLearnerReviewFileAPI)
      .mockResolvedValueOnce(new Blob(["x"]))
      .mockResolvedValueOnce(null);
    renderPage();
    const button = await screen.findByText(/Download submitted work/);
    fireEvent.click(button);
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(api.downloadLearnerReviewFileAPI).toHaveBeenCalledWith("review-1");
    fireEvent.click(button);
    await screen.findByText("Unable to download the file.");
    click.mockRestore();
  });
});
