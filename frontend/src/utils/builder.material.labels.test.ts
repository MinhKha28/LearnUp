import { expect, it } from "vitest";
import { materialFileStatusText, materialTypeText, uploadSubscriptionStatusText } from "./builder.material.labels";

it.each([
  ["Video", "Video"],
  ["Reading", "Tài liệu đọc"],
  ["Unknown", "Chưa xác định"],
])("labels material type %s", (value, label) => {
  expect(materialTypeText(value)).toBe(label);
});

it.each([
  ["Pending", "Chờ xử lý"],
  ["Ready", "Sẵn sàng"],
  ["Unknown", "Chưa xác định"],
])("labels material file status %s", (value, label) => {
  expect(materialFileStatusText(value)).toBe(label);
});

it.each([
  ["Active", "Đang hoạt động"],
  ["Grace", "Trong thời gian ân hạn"],
  ["Suspended", "Tạm ngưng"],
  ["Unknown", "Chưa xác định"],
  [null, "Chưa xác định"],
])("labels subscription status %s", (value, label) => {
  expect(uploadSubscriptionStatusText(value)).toBe(label);
});
