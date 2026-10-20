import { SearchOutlined } from "@ant-design/icons";
import { Empty, Input, Select, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AccountTable, {
  statusLabel,
} from "@/components/organizer/account.table";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import {
  getLearnerSeatsAPI,
  getLearnersAPI,
} from "@/services/organization.service";
import type {
  AccountStatus,
  ILearnerListItem,
  ISeatUsage,
} from "@/types/organization.types";
import { seatBlockReason } from "@/utils/helper";
import "./learners.scss";

const COMING_SOON = "Coming soon";
const SEARCH_DEBOUNCE_MS = 400;

// UC13.4 - "all" = không gửi status; nhãn trạng thái lấy chung với cột Status
type StatusFilter = AccountStatus | "all";
const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...(Object.keys(statusLabel) as AccountStatus[]).map((status) => ({
    value: status,
    label: statusLabel[status],
  })),
];

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

  // UC13.4 - searchInput là giá trị đang gõ; keyword là giá trị đã debounce dùng để gọi API
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const hasFilter = keyword !== "" || status !== "all";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = searchInput.trim().replace(/\s+/g, " ");
      if (normalized !== keyword) {
        setKeyword(normalized);
        setPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, keyword]);

  useEffect(() => {
    // ignore: bỏ kết quả của request cũ khi bộ lọc / trang đổi trước lúc nó trả về
    let ignore = false;
    const loadLearners = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await getLearnersAPI({
          page,
          pageSize,
          keyword: keyword || undefined,
          status: status === "all" ? undefined : status,
        });
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
  }, [page, pageSize, keyword, status, reloadKey]);

  // UC13.2 - số chỗ Learner (quyết định bật nút Add Learner)
  const [seats, setSeats] = useState<ISeatUsage | null>(null);
  const [seatsLoading, setSeatsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const loadSeats = async () => {
      setSeatsLoading(true);
      try {
        const res = await getLearnerSeatsAPI();
        if (!ignore) setSeats(res.data ?? null);
      } catch {
        if (!ignore) setSeats(null);
      } finally {
        if (!ignore) setSeatsLoading(false);
      }
    };
    loadSeats();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const addBlockedReason = seatsLoading
    ? "Checking available seats…"
    : seatBlockReason(seats, "Learner");

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
            {addBlockedReason ? (
              <Tooltip title={addBlockedReason}>
                <span>
                  <OrganizerButton type="primary" disabled>
                    Add Learner
                  </OrganizerButton>
                </span>
              </Tooltip>
            ) : (
              <Link to="/organizer/learners/add">
                <OrganizerButton type="primary">Add Learner</OrganizerButton>
              </Link>
            )}
          </>
        }
      />
      <SectionCard
        title="Learner accounts"
        extra={
          seats && (
            <span className="organizer-note">
              {seats.used} / {seats.max} seats used
            </span>
          )
        }
      >
        {/* UC13.4 */}
        <div className="organizer-filters organizer-instructors-filters">
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search by name or email"
            allowClear
            maxLength={100}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Select<StatusFilter>
            value={status}
            options={statusOptions}
            onChange={(nextStatus) => {
              setStatus(nextStatus);
              setPage(1);
            }}
          />
        </div>
        <AccountTable<ILearnerListItem>
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          error={error}
          itemLabel="learners"
          emptyText={
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                hasFilter ? "No matching learners found." : "No learners yet."
              }
            />
          }
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
