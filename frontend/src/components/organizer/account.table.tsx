import { Alert, Button, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { StatusTag } from "@/components/organizer/organizer.ui";
import type {
  AccountStatus,
  IAccountListItem,
} from "@/types/organization.types";
import { formatDateVN } from "@/utils/helper";
import "./account.table.scss";

const ACCOUNT_PAGE_SIZES = [10, 20, 50];

const statusLabel: Record<AccountStatus, string> = {
  Active: "Active",
  Pending: "Pending activation",
  Deactivated: "Deactivated",
};

const statusTone = (status: AccountStatus) =>
  status === "Active"
    ? "success"
    : status === "Pending"
      ? "warning"
      : "neutral";

// Bảng tài khoản trong tổ chức, dùng chung cho Instructor (UC12) và Learner (UC13).
// Trang cha lo gọi API; cột riêng (vd. số Course) truyền qua extraColumns,
// thao tác từng dòng (UC12.1, 12.3, 12.5, 12.6, 12.7…) truyền qua renderActions.
const AccountTable = <T extends IAccountListItem>({
  rows,
  total,
  page,
  pageSize,
  loading,
  error,
  itemLabel,
  emptyText,
  extraColumns = [],
  renderActions,
  onPageChange,
  onRetry,
}: {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: boolean;
  itemLabel: string;
  emptyText: string;
  extraColumns?: ColumnsType<T>;
  renderActions?: (item: T) => ReactNode;
  onPageChange: (page: number, pageSize: number) => void;
  onRetry: () => void;
}) => {
  if (error) {
    return (
      <Alert
        className="account-table-error"
        type="error"
        showIcon
        message={`Could not load ${itemLabel}.`}
        description="Please check your connection and try again."
        action={<Button onClick={onRetry}>Try again</Button>}
      />
    );
  }

  const columns: ColumnsType<T> = [
    {
      title: "Full name",
      dataIndex: "fullName",
      render: (fullName: string) => <strong>{fullName}</strong>,
    },
    { title: "Email", dataIndex: "email" },
    {
      title: "Work unit",
      dataIndex: "department",
      render: (department: string | null) => department || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (_, item) => (
        <div className="account-table-status">
          <StatusTag tone={statusTone(item.status)}>
            {statusLabel[item.status]}
          </StatusTag>
          {item.status === "Pending" && item.invitationExpired && (
            <StatusTag tone="error">Invitation expired</StatusTag>
          )}
        </div>
      ),
    },
    ...extraColumns,
    {
      title: "Created",
      dataIndex: "createdAt",
      render: (createdAt: string) => formatDateVN(createdAt),
    },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: (_, item) => renderActions?.(item) ?? null,
    },
  ];

  return (
    <Table<T>
      className="organizer-table account-table"
      rowKey="id"
      columns={columns}
      dataSource={rows}
      loading={loading}
      locale={{ emptyText }}
      scroll={{ x: "max-content" }}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: ACCOUNT_PAGE_SIZES.map(String),
        showTotal: (count) => `${count} ${itemLabel}`,
        position: ["bottomRight"],
        onChange: (nextPage, nextPageSize) =>
          // Đổi số dòng mỗi trang thì quay về trang 1.
          onPageChange(nextPageSize === pageSize ? nextPage : 1, nextPageSize),
      }}
    />
  );
};

export default AccountTable;
