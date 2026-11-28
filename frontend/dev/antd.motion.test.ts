// @vitest-environment jsdom-native
/// <reference lib="dom" />
import { createElement } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { Modal, message } from "antd";
import { afterEach, expect, it } from "vitest";

afterEach(() => {
  message.destroy();
  cleanup();
});

it("closes a Modal without animation completion events", async () => {
  const view = render(createElement(Modal, { open: true }, "motion guard modal"));
  const wrapper = document.querySelector<HTMLElement>(".ant-modal-wrap");
  expect(wrapper).not.toBeNull();
  expect(wrapper?.style.display).not.toBe("none");
  view.rerender(createElement(Modal, { open: false }, "motion guard modal"));
  await waitFor(() => expect(wrapper?.style.display).toBe("none"));
});

it("destroys a static message without animation completion events", async () => {
  act(() => { message.success({ key: "motion-guard", content: "motion guard message", duration: 0 }); });
  await waitFor(() => expect(document.querySelector(".ant-message-notice")).not.toBeNull());
  act(() => { message.destroy("motion-guard"); });
  await waitFor(() => expect(document.querySelector(".ant-message-notice")).toBeNull());
});
