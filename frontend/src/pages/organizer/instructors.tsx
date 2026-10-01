import { SearchOutlined } from "@ant-design/icons";
import { Input, Select, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AccountTable from "@/components/organizer/account.table";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import {
  getInstructorSeatsAPI,
  getInstructorsAPI,
} from "@/services/organization.service";
import type {
  IInstructorListItem,
  ISeatUsage,
} from "@/types/organization.types";
import { seatBlockReason } from "@/utils/helper";
import "./instructors.scss";

const COMING_SOON = "Coming soon";

// UC12 - cột riêng của Instructor: số Course đang phụ trách (null: chưa lấy được)
const courseColumns: ColumnsType<IInstructorListItem> = [
  {
    title: "Courses",
    dataIndex: "managedCourseCount",
    render: (count: number | null) => count ?? "—",
  },
];

const Instructors = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<IInstructorListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    const loadInstructors = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await getInstructorsAPI({ page, pageSize });
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
    loadInstructors();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, reloadKey]);

  // UC12.2 - số chỗ Instructor (quyết định bật nút Add Instructor)
  const [seats, setSeats] = useState<ISeatUsage | null>(null);
  const [seatsLoading, setSeatsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const loadSeats = async () => {
      setSeatsLoading(true);
      try {
        const res = await getInstructorSeatsAPI();
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
    : seatBlockReason(seats, "Instructor");

  return (
    <OrganizerPage className="organizer-instructors">
      <PageHeader
        title="Instructors"
        subtitle="Manage instructor accounts in your organization."
        actions={
          <>
            {/* UC12.8 */}
            <Tooltip title={COMING_SOON}>
              <span>
                <OrganizerButton disabled>Import Excel</OrganizerButton>
              </span>
            </Tooltip>
            {/* UC12.2 */}
            {addBlockedReason ? (
              <Tooltip title={addBlockedReason}>
                <span>
                  <OrganizerButton type="primary" disabled>
                    Add Instructor
                  </OrganizerButton>
                </span>
              </Tooltip>
            ) : (
              <Link to="/organizer/instructors/add">
                <OrganizerButton type="primary">Add Instructor</OrganizerButton>
              </Link>
            )}
          </>
        }
      />
      <SectionCard
        title="Instructor accounts"
        extra={
          seats && (
            <span className="organizer-note">
              {seats.used} / {seats.max} seats used
            </span>
          )
        }
      >
        {/* UC12.4 */}
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
        <AccountTable<IInstructorListItem>
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          error={error}
          itemLabel="instructors"
          emptyText="No instructors yet."
          extraColumns={courseColumns}
          // UC12.1 / 12.3 / 12.5 / 12.6 / 12.7 gắn thao tác vào đây
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

export default Instructors;
