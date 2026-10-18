import { it, expect } from "vitest";
import { retainAssignmentSelection } from "./assignment.selection";
it("UC24.2 preserves page-one selection when selecting Learner 51 on page two and removes only deselected IDs", () => {
  const first = { id: "learner-1", name: "Một" };
  const second = { id: "learner-51", name: "Năm mươi mốt" };
  const page1 = retainAssignmentSelection({}, [first.id], [first]);
  const page2 = retainAssignmentSelection(
    page1,
    [first.id, second.id],
    [second],
  );
  expect(Object.values(page2)).toEqual([first, second]);
  expect(retainAssignmentSelection(page2, [second.id], [second])).toEqual({
    [second.id]: second,
  });
});
