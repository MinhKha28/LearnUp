import { SearchOutlined } from "@ant-design/icons";
import { Input, Select, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import AccountTable from "@/components/organizer/account.table";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { getLearnersAPI } from "@/services/organization.service";
import type { ILearnerListItem } from "@/types/organization.types";
import "./learners.scss";

const COMING_SOON = "Coming soon";

// UC13 - cột riêng của Learner: tình trạng tham gia đào tạo (null: chưa lấy được)
const trainingColumns: ColumnsType<ILearnerListItem> = [
  {
    title: "Courses",
    dataIndex: "activeCourseCount",
    render: (count: number | null) => count ?? "—",
  },
  {
    title: "Overdue",
    dataIndex: "overdueCourseCount",
    render: (count: number | null) =>
      count === null ? (
        "—"
      ) : count > 0 ? (
        <StatusTag tone="warning">{count}</StatusTag>
      ) : (
        count
      ),
  },
];

const Learners = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<ILearnerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    const loadLearners = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await getLearnersAPI({ page, pageSize });
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
    loadLearners();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, reloadKey]);

  return (
    <OrganizerPage className="organizer-learners">
      <PageHeader
        title="Learners"
        subtitle="Manage learner accounts in your organization."
        actions={
          <>
            {/* UC13.8 */}
            <Tooltip title={COMING_SOON}>
              <span>
                <OrganizerButton disabled>Import Excel</OrganizerButton>
              </span>
            </Tooltip>
            {/* UC13.2 */}
            <Tooltip title={COMING_SOON}>
              <span>
                <OrganizerButton type="primary" disabled>
                  Add Learner
                </OrganizerButton>
              </span>
            </Tooltip>
          </>
        }
      />
      {/* UC13.2 gắn "x / y seats used" vào extra */}
      <SectionCard title="Learner accounts">
        {/* UC13.4 */}
        <div className="organizer-filters organizer-instructors-filters">
          <Tooltip title={COMING_SOON}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search by name or email"
              disabled
            />
          </Tooltip>
          <Tooltip title={COMING_SOON}>
            <Select
              defaultValue="all"
              disabled
              options={[{ value: "all", label: "All statuses" }]}
            />
          </Tooltip>
        </div>
        <AccountTable<ILearnerListItem>
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          error={error}
          itemLabel="learners"
          emptyText="No learners yet."
          extraColumns={trainingColumns}
          // UC13.1 / 13.3 / 13.5 / 13.6 / 13.7 gắn thao tác vào đây
          renderActions={() => (
            <Tooltip title={COMING_SOON}>
              <span>
                <button className="organizer-link" disabled>
                  View details →
                </button>
              </span>
            </Tooltip>
          )}
          onPageChange={(nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      </SectionCard>
    </OrganizerPage>
  );
};

export default Learners;
