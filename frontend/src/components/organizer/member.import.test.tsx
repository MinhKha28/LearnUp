// @vitest-environment jsdom
import { App } from "antd";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({ tenantAxios: {}, default: {} }));

import MemberImport, { type MemberImportRole } from "@/components/organizer/member.import";
import type { IMemberImportPreview } from "@/types/organization.types";

beforeAll(() => {
  const computedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (element) => computedStyle(element);
  window.matchMedia = (media) => ({
    matches: false,
    media,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
});

afterEach(() => {
  cleanup();
});

const preview = (role: MemberImportRole): IMemberImportPreview => ({
  role,
  totalRows: 2,
  validRows: [{ rowNumber: 2, fullName: "Nguyễn Văn An", email: "an@example.com", department: null }],
  invalidRows: [],
  seats: { used: 1, max: 10, remaining: 9, subscriptionStatus: "Active", canCreate: true },
  exceedsSeats: false,
  canConfirm: true,
  previewDigest: "digest",
});

const show = (role: MemberImportRole) => {
  const previewImport = vi.fn().mockResolvedValue({ data: preview(role) });
  const utils = render(
    <MemoryRouter>
      <App>
        <MemberImport
          role={role}
          className="test-import"
          listPath="/organizer/learners"
          templateFileName="mau.xlsx"
          downloadTemplate={vi.fn()}
          previewImport={previewImport}
          confirmImport={vi.fn()}
        />
      </App>
    </MemoryRouter>,
  );
  return { ...utils, previewImport };
};

describe("UC12.8 / UC13.8 import instructions", () => {
  it.each(["Instructor", "Learner"] as const)("names the Vietnamese columns of the %s template", (role) => {
    const { container } = show(role);
    const help = container.querySelector(".organizer-import-columns")!;
    const columns = [...help.querySelectorAll("li strong")].map((item) => item.textContent);
    expect(columns).toEqual(["Họ tên", "Email", "Đơn vị công tác", "Vai trò"]);
    expect(help.textContent).toContain(`điền đúng giá trị "${role}"`);
    expect(help.textContent).not.toMatch(/tiếng Anh|Full name|Department/);
  });

  it.each([
    ["Learner", "Mỗi học viên mới sẽ nhận email mời"],
    ["Instructor", "Mỗi giảng viên mới sẽ nhận email mời"],
  ] as const)("keeps the space after \"Mỗi\" in the %s preview note", async (role, sentence) => {
    const { container, previewImport } = show(role);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "list.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })] },
    });
    expect(await screen.findByText(new RegExp(sentence))).toBeTruthy();
    expect(previewImport).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toMatch(/Mỗi(học|giảng)/);
  });
});
