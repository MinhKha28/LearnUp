import {
  Alert,
  Button,
  Form,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Table,
  message,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AssignmentError } from "@/components/organizer/assignment.error";
import {
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import { toApiError } from "@/services/api.client";
import {
  assignCourse,
  fetchAssignmentCourses,
  fetchAssignmentLearners,
} from "@/services/assignment.service";
import type { ApiError } from "@/types/api.types";
import type { InvalidLearner } from "@/types/assignment.types";
import type { ILearnerListItem } from "@/types/organization.types";
import {
  assignmentErrorMessage,
  assignmentResultMessage,
  invalidAssignmentLearners,
} from "@/utils/assignments.view";
import "./assignment.create.scss";

const AssignmentCreate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<{ courseId: string }>();
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [coursePage, setCoursePage] = useState(1);
  const [learnerPage, setLearnerPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, ILearnerListItem>>(
    {},
  );
  const [chosenCourse, setChosenCourse] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [invalid, setInvalid] = useState<InvalidLearner[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const [notice, contextHolder] = message.useMessage();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(rawSearch.trim());
      setCoursePage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [rawSearch]);
  const courses = useApiQuery(
    (signal) => fetchAssignmentCourses(coursePage, search, signal),
    [coursePage, search],
    true,
  );
  const learners = useApiQuery(
    (signal) => fetchAssignmentLearners(learnerPage, signal),
    [learnerPage],
    true,
  );
  const selectedRows = Object.values(selected);
  const courseOptions = (courses.data?.result ?? []).map((course) => ({
    value: course.id,
    label: `${course.name} · Phiên bản ${course.versionNumber}`,
  }));
  if (
    chosenCourse &&
    !courseOptions.some((option) => option.value === chosenCourse.value)
  )
    courseOptions.unshift(chosenCourse);
  const remove = (ids: string[]) =>
    setSelected((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => !ids.includes(id)),
      ),
    );
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await form.validateFields();
    } catch {
      submitting.current = false;
      return;
    }
    if (!selectedRows.length) {
      setSelectionError("Hãy chọn ít nhất một Learner.");
      submitting.current = false;
      return;
    }
    setPending(true);
    setError(null);
    setInvalid([]);
    try {
      const result = await assignCourse(
        form.getFieldValue("courseId"),
        selectedRows.map((row) => row.id),
      );
      navigate("/organizer/assignments", {
        state: { assignmentSummary: assignmentResultMessage(result) },
      });
    } catch (cause) {
      const apiError = toApiError(cause);
      setError(apiError);
      if (apiError.code === "ASSIGNMENT_INVALID_LEARNERS")
        setInvalid(invalidAssignmentLearners(apiError.details));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  const learnerColumns = [
    { title: "Họ tên", dataIndex: "fullName" },
    { title: "Email", dataIndex: "email" },
    {
      title: "Phòng ban",
      dataIndex: "department",
      render: (value: string | null) => value ?? "—",
    },
  ];
  return (
    <OrganizerPage className="organizer-assignment-create">
      {contextHolder}
      <PageHeader
        title="Phân công Course"
        subtitle="Chọn một Course Published và tối đa 500 Learner."
        actions={
          <>
            <Button
              disabled={pending}
              onClick={() => navigate("/organizer/assignments")}
            >
              Hủy
            </Button>
            <Button type="primary" loading={pending} onClick={submit}>
              Phân công
            </Button>
          </>
        }
      />
      {error && <AssignmentError error={error} retry={submit} />}
      {invalid.length > 0 && (
        <SectionCard
          title="Learner có lỗi"
          extra={
            <Button
              disabled={pending}
              onClick={() => {
                remove(invalid.map((row) => row.learnerId));
                setInvalid([]);
                setError(null);
              }}
            >
              Bỏ chọn các Learner lỗi
            </Button>
          }
        >
          <Alert
            type="error"
            showIcon
            message="Không ai được phân công khi có lỗi. Lựa chọn của bạn vẫn được giữ nguyên."
          />
          <Table
            rowKey="learnerId"
            dataSource={invalid}
            pagination={false}
            scroll={{ x: true }}
            columns={[
              {
                title: "Learner",
                key: "learner",
                render: (_, row) =>
                  selected[row.learnerId]
                    ? `${selected[row.learnerId].fullName} · ${selected[row.learnerId].email}`
                    : row.learnerId,
              },
              {
                title: "Lý do",
                dataIndex: "reason",
                render: (reason: string) => assignmentErrorMessage(reason),
              },
            ]}
          />
        </SectionCard>
      )}
      <SectionCard title="Course Published">
        {courses.status === "error" ? (
          <AssignmentError error={courses.error} retry={courses.reload} />
        ) : !courses.data ? (
          <Skeleton active />
        ) : (
          <>
            <Form form={form} layout="vertical" disabled={pending}>
              <Form.Item
                name="courseId"
                label="Course"
                rules={[
                  { required: true, message: "Hãy chọn một Course Published." },
                ]}
              >
                <Select
                  showSearch
                  filterOption={false}
                  searchValue={rawSearch}
                  onSearch={setRawSearch}
                  loading={courses.status === "loading"}
                  options={courseOptions}
                  placeholder="Tìm Course theo tên"
                  notFoundContent="Không có Course Published phù hợp"
                  onChange={(value) =>
                    setChosenCourse(
                      courseOptions.find((option) => option.value === value) ??
                        null,
                    )
                  }
                />
              </Form.Item>
            </Form>
            <Pagination
              current={coursePage}
              pageSize={20}
              total={courses.data.meta.total}
              showSizeChanger={false}
              disabled={pending || courses.status === "loading"}
              onChange={setCoursePage}
              locale={{
                prev_page: "Trang Course trước",
                next_page: "Trang Course sau",
              }}
            />
          </>
        )}
      </SectionCard>
      <SectionCard
        title={`Đã chọn ${selectedRows.length} / 500`}
        extra={
          <Button
            disabled={!selectedRows.length || pending}
            onClick={() => setReviewOpen(true)}
          >
            Xem lại / bỏ chọn
          </Button>
        }
      >
        <p>
          Chưa hỗ trợ tìm Learner theo tên hoặc email. Chuyển trang để chọn
          thêm; lựa chọn được giữ nguyên.
        </p>
        {selectionError && (
          <Alert type="error" message={selectionError} showIcon />
        )}
        {learners.status === "error" ? (
          <AssignmentError error={learners.error} retry={learners.reload} />
        ) : !learners.data ? (
          <Skeleton active />
        ) : (
          <Table
            rowKey="id"
            dataSource={learners.data.items}
            columns={learnerColumns}
            loading={learners.status === "loading"}
            scroll={{ x: true }}
            locale={{ emptyText: "Không có Learner trong tổ chức" }}
            rowSelection={{
              selectedRowKeys: Object.keys(selected),
              preserveSelectedRowKeys: true,
              getCheckboxProps: (row) => ({
                disabled:
                  pending || (!selected[row.id] && selectedRows.length >= 500),
              }),
              onChange: (keys, rows) => {
                if (keys.length > 500) {
                  void notice.warning("Chỉ được chọn tối đa 500 Learner.");
                  return;
                }
                setSelected(
                  Object.fromEntries(rows.map((row) => [row.id, row])),
                );
                setSelectionError("");
              },
            }}
            pagination={{
              current: learnerPage,
              pageSize: 50,
              total: learners.data.meta.total,
              showSizeChanger: false,
              disabled: pending,
              onChange: setLearnerPage,
              locale: {
                prev_page: "Trang Learner trước",
                next_page: "Trang Learner sau",
              },
            }}
          />
        )}
        <p>
          Hạn hoàn thành được backend tính cho từng Learner. Tiến độ và kết quả
          tự chọn được giữ lại khi chuyển thành bắt buộc.
        </p>
      </SectionCard>
      <Modal
        title={`Learner đã chọn (${selectedRows.length} / 500)`}
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        footer={<Button onClick={() => setReviewOpen(false)}>Đóng</Button>}
      >
        <Table
          rowKey="id"
          dataSource={selectedRows}
          columns={[
            ...learnerColumns.slice(0, 2),
            {
              title: "Thao tác",
              key: "remove",
              render: (_, row) => (
                <Button disabled={pending} onClick={() => remove([row.id])}>
                  Bỏ chọn
                </Button>
              ),
            },
          ]}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: true }}
          locale={{ emptyText: "Chưa chọn Learner" }}
        />
      </Modal>
    </OrganizerPage>
  );
};
export default AssignmentCreate;
