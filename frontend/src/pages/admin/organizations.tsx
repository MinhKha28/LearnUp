import { Alert, Avatar, Button, Checkbox, Empty, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import { getAdminOrganizationsAPI } from "@/services/organization.service";
import type { IAdminOrganizationListItem } from "@/types/organization.types";
import {
  noSubscriptionLabel,
  organizationStatusView,
  subscriptionStatusView,
  subscriptionTermLabel,
} from "@/utils/organization.list.view";
import "./organizations.scss";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

// UC44 - Xem danh sách Organization. Tìm kiếm và lọc theo tên, gói, trạng thái là UC44.2.
const Organizations = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Mặc định ẩn Cancelled (BR-8, BR-12); bật để xem cả nhóm này
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [rows, setRows] = useState<IAdminOrganizationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // ignore: bỏ kết quả của request cũ khi trang / bộ lọc đổi trước lúc nó trả về
    let ignore = false;
    const loadOrganizations = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await getAdminOrganizationsAPI({ page, pageSize, includeCancelled });
        if (ignore) return;
        if (res.data) {
          setRows(res.data.items);
          setTotal(res.data.meta.total);
        } else {
          setError(true);
        }
      } catch {
        if (!ignore) setError(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    loadOrganizations();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, includeCancelled, reloadKey]);

  const columns: ColumnsType<IAdminOrganizationListItem> = [
    {
      title: "Organization",
      dataIndex: "name",
      render: (_, record) => (
        <div className="admin-avatar-name">
          <Avatar style={{ background: "#e2e8f0", color: "#475569" }}>{record.name.slice(0, 2).toUpperCase()}</Avatar>
          <div>
            <strong>{record.name}</strong>
            <small>{record.contactEmail ?? "—"}</small>
          </div>
        </div>
      ),
    },
    { title: "Plan", key: "plan", render: (_, record) => record.plan?.name ?? "—" },
    {
      title: "Org status",
      dataIndex: "status",
      render: (_, record) => {
        const view = organizationStatusView[record.status];
        return <StatusTag tone={view.tone}>{view.label}</StatusTag>;
      },
    },
    {
      title: "Subscription",
      key: "subscription",
      render: (_, record) => {
        if (!record.subscription) return <StatusTag tone="neutral">{noSubscriptionLabel(record)}</StatusTag>;
        const view = subscriptionStatusView[record.subscription.status];
        return <StatusTag tone={view.tone}>{view.label}</StatusTag>;
      },
    },
    {
      title: "Term",
      key: "term",
      render: (_, record) => {
        const term = subscriptionTermLabel(record);
        return (
          <div>
            <div>{term.primary}</div>
            {term.secondary && <small className="admin-note">{term.secondary}</small>}
          </div>
        );
      },
    },
    {
      title: "Action",
      key: "action",
      align: "right",
      render: (_, record) => (
        <button className="admin-link" onClick={() => navigate(`/admin/organizations/${encodeURIComponent(record.id)}`)}>
          View details
        </button>
      ),
    },
  ];

  return (
    <AdminPage className="admin-organizations">
      <PageHeader
        title="Organizations"
        subtitle="View every organization, its current plan, organization status, and subscription lifecycle."
        actions={
          <Link to="/admin/suspended-organizations">
            <AdminButton>View suspended</AdminButton>
          </Link>
        }
      />
      <SectionCard
        title="All organizations"
        extra={<span className="admin-note">{loading ? "Loading…" : `${total} organizations`}</span>}
      >
        <div className="admin-filters">
          <Checkbox
            checked={includeCancelled}
            onChange={(event) => {
              setIncludeCancelled(event.target.checked);
              setPage(1);
            }}
          >
            Show cancelled organizations
          </Checkbox>
        </div>
        {error ? (
          <Alert
            className="admin-filters"
            type="error"
            showIcon
            message="Could not load organizations."
            description="Please check your connection and try again."
            action={<Button onClick={() => setReloadKey((key) => key + 1)}>Try again</Button>}
          />
        ) : (
          <Table
            className="admin-table"
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            locale={{ emptyText: <Empty description="No organization yet" /> }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              position: ["bottomRight"],
              onChange: (nextPage, nextPageSize) => {
                if (nextPageSize !== pageSize) {
                  setPageSize(nextPageSize);
                  setPage(1);
                } else {
                  setPage(nextPage);
                }
              },
            }}
          />
        )}
      </SectionCard>
    </AdminPage>
  );
};

export default Organizations;
