import { Form, Input, Modal, Select, Spin, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import {
  fetchTransferContextAPI,
  transferCourseOwnershipAPI,
} from "@/services/course.service";
import { getTransferCandidatesAPI } from "@/services/organization.service";
import type {
  CourseStatus,
  ITransferCandidate,
  ITransferCourseContext,
  ITransferCourseRequest,
  ITransferCourseVersion,
} from "@/types/course.types";
import { courseStatusText } from "@/utils/organizer.labels";
import "./course.detail.scss";
import { VietnameseAlert } from "@/components/vietnamese.controls";

type ApiResult<T> = {
  statusCode?: number;
  data?: T;
  code?: string;
  error?: { code?: string };
  message?: string;
};

const readApiResult = <T,>(raw: unknown): ApiResult<T> => {
  if (!raw || typeof raw !== "object") return {};
  const value = raw as ApiResult<T> & { data?: T | ApiResult<T> };
  if (typeof value.statusCode === "number" || value.error || value.code) {
    return value as ApiResult<T>;
  }
  // Axios interceptor sometimes returns an unwrapped AxiosResponse.
  const nested = value.data;
  if (nested && typeof nested === "object" && "statusCode" in nested) {
    return nested as ApiResult<T>;
  }
  return {};
};

const apiErrorCode = (raw: unknown) => {
  const result = readApiResult<unknown>(raw);
  if (result.code || result.error?.code) return result.code ?? result.error?.code;
  if (raw && typeof raw === "object" && "response" in raw) {
    const response = (raw as { response?: { data?: unknown } }).response;
    return readApiResult<unknown>(response?.data).code ??
      readApiResult<unknown>(response?.data).error?.code;
  }
  return undefined;
};

const statusTone = (status: CourseStatus) =>
  status === "Published" ? "info" :
  status === "Submitted" ? "warning" :
  status === "Rejected" || status === "Disabled" ? "error" : "neutral";

const formatDate = (date?: string | null) => {
  if (!date) return "—";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("vi-VN");
};

const columns: ColumnsType<ITransferCourseVersion> = [
  { title: "Phiên bản", dataIndex: "versionNumber", key: "versionNumber",
    render: (value: number) => "v" + value },
  { title: "Trạng thái", dataIndex: "status", key: "status",
    render: (status: CourseStatus) => (
      <StatusTag tone={statusTone(status)}>{courseStatusText(status)}</StatusTag>
    ) },
  { title: "Ngày tạo", dataIndex: "createdAt", key: "createdAt",
    render: (value: string) => formatDate(value) },
  { title: "Ngày xuất bản", dataIndex: "publishedAt", key: "publishedAt",
    render: (value: string | null) => formatDate(value) },
];

const CourseDetail = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [form] = Form.useForm<ITransferCourseRequest>();
  const [context, setContext] = useState<ITransferCourseContext | null>(null);
  const [candidates, setCandidates] = useState<ITransferCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const inFlight = useRef(false);
  const loadSequence = useRef(0);

  const instructorResolved = Boolean(context?.currentInstructor.fullName?.trim()) &&
    context?.currentInstructor.resolved !== false;

  const loadContext = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!courseId) {
      setError("Không tìm thấy mã khóa học.");
      setContext(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const raw: unknown = await fetchTransferContextAPI(courseId);
      const response = readApiResult<ITransferCourseContext>(raw);
      if (response.statusCode !== 200 || !response.data?.chainId) {
        throw raw;
      }
      if (sequence !== loadSequence.current) return;
      setContext(response.data);
      setError("");
    } catch {
      if (sequence !== loadSequence.current) return;
      setContext(null);
      setError("Không thể tải thông tin khóa học. Vui lòng thử lại.");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadContext();
    return () => { loadSequence.current += 1; };
  }, [loadContext]);

  const openTransfer = async () => {
    if (!context || candidatesLoading || inFlight.current) return;
    if (!instructorResolved) {
      message.warning("Không xác định được giảng viên đang phụ trách. Vui lòng kiểm tra thông tin tài khoản.");
      return;
    }
    setCandidatesLoading(true);
    setModalError("");
    try {
      const raw: unknown = await getTransferCandidatesAPI(
        context.currentInstructor.id,
      );
      const result = readApiResult<ITransferCandidate[]>(raw);
      if (result.statusCode !== 200 || !Array.isArray(result.data)) {
        throw raw;
      }
      setCandidates(result.data.filter(
        (candidate) => candidate.id !== context.currentInstructor.id,
      ));
      form.resetFields();
      setTransferOpen(true);
    } catch {
      message.error("Không lấy được danh sách giảng viên tiếp nhận.");
    } finally {
      setCandidatesLoading(false);
    }
  };

  const closeTransfer = () => {
    if (inFlight.current) return;
    setTransferOpen(false);
    setModalError("");
    form.resetFields();
  };

  const submitTransfer = async () => {
    if (!courseId || !context || inFlight.current) return;
    let values: ITransferCourseRequest;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    inFlight.current = true;
    setTransferring(true);
    setModalError("");
    try {
      const raw: unknown = await transferCourseOwnershipAPI(courseId, {
        toInstructorId: values.toInstructorId,
        expectedInstructorId: context.currentInstructor.id,
        ...(values.reason?.trim() ? { reason: values.reason.trim() } : {}),
      });
      const result = readApiResult<{ chainId: string }>(raw);
      if (result.statusCode !== 200 || !result.data?.chainId) {
        throw raw;
      }
      setTransferOpen(false);
      form.resetFields();
      message.success("Chuyển quyền phụ trách khóa học thành công.");
      await loadContext();
    } catch (failure) {
      const code = apiErrorCode(failure);
      const text = code === "INVALID_RECEIVER"
        ? "Giảng viên tiếp nhận không hợp lệ hoặc không còn hoạt động."
        : code === "COURSE_CHANGED" || code === "SAME_INSTRUCTOR"
          ? "Quyền phụ trách đã thay đổi. Vui lòng tải lại dữ liệu."
          : code === "TENANT_UNAVAILABLE"
            ? "Dịch vụ tổ chức tạm thời gián đoạn. Vui lòng thử lại."
            : "Chuyển quyền thất bại. Vui lòng thử lại.";
      setModalError(text);
      message.error(text);
      await loadContext();
    } finally {
      inFlight.current = false;
      setTransferring(false);
    }
  };

  return (
    <OrganizerPage className="organizer-course-detail">
      <PageHeader
        title="Chuỗi phiên bản khóa học"
        subtitle={context?.courseName ?? "Thông tin khóa học"}
        back
        actions={
          <>
            {courseId && (
              <Link to={"/organizer/courses/" + courseId + "/version-report"}>
                <OrganizerButton>Báo cáo phiên bản</OrganizerButton>
              </Link>
            )}
            <OrganizerButton
              type="primary"
              disabled={!context || !instructorResolved || loading || candidatesLoading}
              loading={candidatesLoading}
              onClick={() => void openTransfer()}
            >
              Chuyển quyền phụ trách
            </OrganizerButton>
          </>
        }
      />

      {error && (
        <VietnameseAlert
          type="error"
          showIcon
          message={error}
          action={<OrganizerButton size="small" onClick={() => void loadContext()}>Thử lại</OrganizerButton>}
        />
      )}

      <SectionCard title="Lịch sử phiên bản">
        {loading ? (
          <div className="organizer-course-detail-loading"><Spin /></div>
        ) : context ? (
          <>
            <div className="organizer-course-detail-owner">
              <span>Giảng viên hiện tại</span>
              <strong>{context.currentInstructor.fullName || "Chưa xác định"}</strong>
            </div>
            {!instructorResolved && (
              <VietnameseAlert
                type="warning"
                showIcon
                message="Không tìm thấy giảng viên phụ trách trong tổ chức."
                description={`Mã giảng viên: ${context.currentInstructor.id}. Hãy kiểm tra dữ liệu tài khoản và tổ chức trước khi chuyển quyền.`}
                className="organizer-course-detail-warning"
              />
            )}
            <Table<ITransferCourseVersion>
              className="organizer-table"
              rowKey="id"
              columns={columns}
              dataSource={context.versions}
              pagination={false}
              locale={{ emptyText: "Khóa học chưa có phiên bản." }}
            />
            <p className="organizer-note organizer-course-detail-note">
              Khi phiên bản mới được phê duyệt, phiên bản đã phát hành trước đó sẽ được lưu trữ. Học viên đã ghi danh vẫn tiếp tục học và có thể được cấp chứng chỉ.
            </p>
          </>
        ) : null}
      </SectionCard>

      <Modal
        className="organizer-transfer-modal"
        open={transferOpen}
        centered
        title="Chuyển quyền phụ trách khóa học"
        onCancel={closeTransfer}
        maskClosable={!transferring}
        closable={!transferring}
        footer={
          <>
            <OrganizerButton disabled={transferring} onClick={closeTransfer}>Hủy</OrganizerButton>
            <OrganizerButton
              type="primary"
              loading={transferring}
              disabled={transferring || candidates.length === 0 || !context || !instructorResolved}
              onClick={() => void submitTransfer()}
            >
              Xác nhận chuyển quyền
            </OrganizerButton>
          </>
        }
      >
        <p>Chuyển toàn bộ chuỗi phiên bản của <strong>{context?.courseName}</strong>.</p>
        {modalError && <VietnameseAlert showIcon type="error" message={modalError} />}
        <Form<ITransferCourseRequest> form={form} layout="vertical" className="organizer-form">
          <Form.Item label="Giảng viên hiện tại">
            <strong>{context?.currentInstructor.fullName || "Chưa xác định"}</strong>
          </Form.Item>
          <Form.Item
            label="Giảng viên tiếp nhận"
            name="toInstructorId"
            rules={[{ required: true, message: "Vui lòng chọn giảng viên tiếp nhận." }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn giảng viên"
              options={candidates.map((item) => ({
                value: item.id,
                label: item.fullName,
              }))}
              notFoundContent="Không có giảng viên phù hợp"
              disabled={transferring}
            />
          </Form.Item>
          <Form.Item label="Lý do (không bắt buộc)" name="reason">
            <Input.TextArea rows={3} maxLength={1000} showCount disabled={transferring} />
          </Form.Item>
        </Form>
        <div className="organizer-approval-note">
          <strong>Lưu ý khi chuyển quyền</strong>
          <span>
            Giảng viên mới tiếp nhận quyền phụ trách tất cả phiên bản khóa học, gồm quyền chỉnh sửa trong phạm vi cho phép, chấm điểm và tạo phiên bản mới. Giảng viên cũ không còn quyền phụ trách sau khi chuyển.
          </span>
        </div>
      </Modal>
    </OrganizerPage>
  );
};

export default CourseDetail;
