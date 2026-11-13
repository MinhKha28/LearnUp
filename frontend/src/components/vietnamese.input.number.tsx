import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { InputNumber, type InputNumberProps } from "antd";

const labelStep = (label: string) => (icon: HTMLSpanElement | null) => {
  // rc-input-number 9 hard-codes the label on the button surrounding each icon.
  icon?.closest('[role="button"]')?.setAttribute("aria-label", label);
};

const stepControls = {
  upIcon: <span aria-hidden="true" ref={labelStep("Tăng giá trị")}><UpOutlined aria-hidden="true" /></span>,
  downIcon: <span aria-hidden="true" ref={labelStep("Giảm giá trị")}><DownOutlined aria-hidden="true" /></span>,
};

export const VietnameseInputNumber = ({
  controls = stepControls,
  decimalSeparator = ",",
  ...props
}: InputNumberProps<number>) => (
  <InputNumber<number> {...props} controls={controls} decimalSeparator={decimalSeparator} />
);
