import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  ExclamationCircleFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
  InfoCircleFilled,
  SwapRightOutlined,
} from "@ant-design/icons";
import { Alert, DatePicker, Input, type AlertProps, type DatePickerProps, type GetProps, type GetRef, type PaginationProps } from "antd";
import { cloneElement, forwardRef, isValidElement, type ReactNode } from "react";

export const vietnameseClear = {
  clearIcon: (
    <CloseCircleFilled
      aria-hidden="true"
      ref={(icon) => icon?.closest('[role="button"]')?.setAttribute("aria-label", "Xóa giá trị")}
    />
  ),
};

const alertIcons = {
  success: <CheckCircleFilled aria-hidden="true" />,
  info: <InfoCircleFilled aria-hidden="true" />,
  warning: <ExclamationCircleFilled aria-hidden="true" />,
  error: <CloseCircleFilled aria-hidden="true" />,
};

export function VietnameseAlert({ type, banner, icon, ...props }: AlertProps) {
  const tone = type ?? (banner ? "warning" : "info");
  return <Alert {...props} type={type} banner={banner} icon={icon ?? alertIcons[tone]} />;
}

export const VietnamesePassword = forwardRef<GetRef<typeof Input.Password>, GetProps<typeof Input.Password>>(
  function VietnamesePassword({ iconRender, disabled, ...props }, ref) {
    return (
      <Input.Password
        {...props}
        ref={ref}
        disabled={disabled}
        iconRender={iconRender ?? ((visible) => (
          <button
            type="button"
            aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            disabled={disabled}
            style={{ background: "none", border: 0, padding: 0 }}
          >
            {visible ? <EyeOutlined aria-hidden="true" /> : <EyeInvisibleOutlined aria-hidden="true" />}
          </button>
        ))}
      />
    );
  },
);

function pickerIcon(picker: DatePickerProps["picker"]) {
  return picker === "time"
    ? <ClockCircleOutlined aria-hidden="true" />
    : <CalendarOutlined aria-hidden="true" />;
}

export const VietnameseDatePicker = forwardRef<GetRef<typeof DatePicker>, DatePickerProps>(
  function VietnameseDatePicker({ allowClear = vietnameseClear, suffixIcon, ...props }, ref) {
    return (
      <DatePicker
        {...props}
        ref={ref}
        allowClear={allowClear === true ? vietnameseClear : allowClear}
        suffixIcon={suffixIcon === undefined ? pickerIcon(props.picker) : suffixIcon}
      />
    );
  },
);

export const VietnameseRangePicker = forwardRef<GetRef<typeof DatePicker.RangePicker>, GetProps<typeof DatePicker.RangePicker>>(
  function VietnameseRangePicker({ allowClear = vietnameseClear, separator, suffixIcon, ...props }, ref) {
    return (
      <DatePicker.RangePicker
        {...props}
        ref={ref}
        allowClear={allowClear === true ? vietnameseClear : allowClear}
        separator={separator === undefined ? <SwapRightOutlined aria-hidden="true" /> : separator}
        suffixIcon={suffixIcon === undefined ? pickerIcon(props.picker) : suffixIcon}
      />
    );
  },
);

export const vietnamesePageItem: NonNullable<PaginationProps["itemRender"]> = (_, type, original) => {
  if ((type !== "prev" && type !== "next") || !isValidElement<{ children?: ReactNode; "aria-label"?: string }>(original)) {
    return original;
  }
  return cloneElement(
    original,
    { "aria-label": type === "prev" ? "Trang trước" : "Trang sau" },
    <span aria-hidden="true">{original.props.children}</span>,
  );
};
