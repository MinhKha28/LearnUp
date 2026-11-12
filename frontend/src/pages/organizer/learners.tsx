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
import { vietnameseClear } from "@/components/vietnamese.controls";

const SEARCH_DEBOUNCE_MS = 400;

// UC13.4 - "all" = không gửi status; nhãn trạng thái lấy chung với cột Status
type StatusFilter = AccountStatus | "all";
const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  ...(Object.keys(statusLabel) as AccountStatus[]).map((status) => ({
    value: status,
    label: statusLabel[status],
  })),
];

// UC13 - cột riêng của Learner: tình trạng tham gia đào tạo (null: chưa lấy được)
const trainingColumns: ColumnsType<ILearnerListItem> = [
  {
    title: "Khóa học",
    dataIndex: "activeCourseCount",
    render: (count: number | null) => count ?? "—",
  },
  {
    title: "Quá hạn",
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
    ? "Đang kiểm tra số suất còn lại…"
    : seatBlockReason(seats, "Học viên");

  return (
    <OrganizerPage className="organizer-learners">
      <PageHeader
        title="Học viên"
        subtitle="Quản lý tài khoản học viên trong tổ chức."
        actions={
          <>
            {/* UC13.8 - cùng điều kiện với Add Learner (BR-31, BR-22); trang import kiểm lại số chỗ */}
            {addBlockedReason ? (
              <Tooltip title={addBlockedReason}>
                <span>
                  <OrganizerButton disabled>Nhập từ Excel</OrganizerButton>
                </span>
              </Tooltip>
            ) : (
              <Link to="/organizer/learners/import">
                <OrganizerButton>Nhập từ Excel</OrganizerButton>
              </Link>
            )}
            {/* UC13.2 */}
            {addBlockedReason ? (
              <Tooltip title={addBlockedReason}>
                <span>
                  <OrganizerButton type="primary" disabled>
                    Thêm học viên
                  </OrganizerButton>
                </span>
              </Tooltip>
            ) : (
              <Link to="/organizer/learners/add">
                <OrganizerButton type="primary">Thêm học viên</OrganizerButton>
              </Link>
            )}
          </>
        }
      />
      <SectionCard
        title="Tài khoản học viên"
        extra={
          seats && (
            <span className="organizer-note">
              {seats.used} / {seats.max} suất đã sử dụng
            </span>
          )
        }
      >
        {/* UC13.4 */}
        <div className="organizer-filters organizer-instructors-filters">
          <Input
            prefix={<SearchOutlined aria-hidden="true" />}
            placeholder="Tìm theo tên hoặc email"
            allowClear={vietnameseClear}
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
          itemLabel="Học viên"
          emptyText={
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                hasFilter ? "Không tìm thấy học viên phù hợp." : "Chưa có học viên nào."
              }
            />
          }
          extraColumns={trainingColumns}
          // UC13.1 - mở chi tiết; UC13.3 / 13.5 / 13.6 / 13.7 gắn thao tác ở trang chi tiết
          renderActions={(item) => (
            <Link
              className="organizer-link"
              to={`/organizer/learners/${item.id}`}
            >
              Xem chi tiết →
            </Link>
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
