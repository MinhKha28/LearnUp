import {
  ArrowLeftOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Alert, Skeleton, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchCourseLessonDetailAPI } from "@/services/course.service";

import type {
  IInstructorLessonDetail,
  IInstructorLessonMaterial,
} from "@/types/course.types";

import "./course.builder.materials.scss";

// Chuyển chuỗi byte từ Backend thành BigInt.
// BigInt tránh sai số khi cộng nhiều file dung lượng lớn.
const toBytes = (value: string): bigint => {
  try {
    const bytes = BigInt(value);
    return bytes >= 0n ? bytes : 0n;
  } catch {
    return 0n;
  }
};

// Hiển thị dung lượng thân thiện: B, KB, MB, GB.
const formatBytes = (bytes: bigint): string => {
  if (bytes < 1024n) {
    return `${bytes.toString()} B`;
  }

  const units = [
    { label: "GB", size: 1024n ** 3n },
    { label: "MB", size: 1024n ** 2n },
    { label: "KB", size: 1024n },
  ];

  const unit = units.find((item) => bytes >= item.size)!;

  // Làm tròn đến một chữ số thập phân.
  const tenths = (bytes * 10n + unit.size / 2n) / unit.size;

  return `${tenths / 10n}.${tenths % 10n} ${unit.label}`;
};

// Icon theo loại học liệu.
const MaterialTypeIcon = ({ type }: { type: string }) => {
  if (type === "Video") {
    return <VideoCameraOutlined />;
  }

  if (type === "Reading") {
    return <FilePdfOutlined />;
  }

  return <FileTextOutlined />;
};

// Metadata bổ sung cho từng học liệu.
const formatMaterialDetail = (
  material: IInstructorLessonMaterial,
): string | null => {
  if (
    material.materialType === "Video" &&
    material.file.durationSeconds !== null
  ) {
    const minutes = Math.ceil(material.file.durationSeconds / 60);
    return `${minutes} min`;
  }

  if (material.materialType === "Reading" && material.file.wordCount !== null) {
    return `${material.file.wordCount.toLocaleString()} words`;
  }

  return null;
};

// Trạng thái học liệu dành cho Instructor.
const MaterialStatus = ({
  material,
}: {
  material: IInstructorLessonMaterial;
}) => {
  if (material.file.releasedAt) {
    return <StatusTag tone="error">Tệp đã được giải phóng</StatusTag>;
  }

  if (material.disabledAt) {
    return <StatusTag tone="error">Đã vô hiệu hóa</StatusTag>;
  }

  if (material.file.status !== "Ready") {
    return <StatusTag tone="warning">{material.file.status}</StatusTag>;
  }

  return <StatusTag tone="success">Sẵn sàng</StatusTag>;
};

// Các cột của bảng UC17.
const columns: ColumnsType<IInstructorLessonMaterial> = [
  {
    title: "Thứ tự",
    dataIndex: "position",
    key: "position",
    width: 78,
    align: "center",
  },
  {
    title: "Học liệu",
    key: "title",
    width: 330,
    render: (_, material) => (
      <div className="uc17-material-name">
        <div className="uc17-material-icon">
          <MaterialTypeIcon type={material.materialType} />
        </div>

        <div className="uc17-material-name-text">
          <strong>{material.title}</strong>
          <span>{material.file.originalFilename}</span>

          {formatMaterialDetail(material) && (
            <small>{formatMaterialDetail(material)}</small>
          )}
        </div>
      </div>
    ),
  },
  {
    title: "Loại",
    dataIndex: "materialType",
    key: "type",
    width: 115,
    render: (type: string) => <StatusTag tone="neutral">{type}</StatusTag>,
  },
  {
    title: "Yêu cầu",
    key: "required",
    width: 135,
    render: (_, material) => (
      <StatusTag tone={material.isRequired ? "warning" : "neutral"}>
        {material.isRequired ? "Bắt buộc" : "Không bắt buộc"}
      </StatusTag>
    ),
  },
  {
    title: "Dung lượng tệp",
    key: "size",
    width: 115,
    align: "right",
    render: (_, material) => (
      <span className="uc17-file-size">
        {formatBytes(toBytes(material.file.sizeBytes))}
      </span>
    ),
  },
  {
    title: "Trạng thái",
    key: "status",
    width: 130,
    render: (_, material) => <MaterialStatus material={material} />,
  },
];

// Hiển thị nội dung khi đã nhận dữ liệu thành công.
const MaterialsContent = ({ data }: { data: IInstructorLessonDetail }) => {
  const materials = data.materials;
  const navigate = useNavigate();

  const columnsWithActions: ColumnsType<IInstructorLessonMaterial> = [
    ...columns,
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      render: (_, material) => (
        <InstructorButton
          onClick={() =>
            navigate(
              `/instructor/courses/${data.course.id}` +
                `/builder/lessons/${data.lesson.id}` +
                `/materials/${material.id}/edit`,
            )
          }
        >
          Chỉnh sửa
        </InstructorButton>
      ),
    },
  ];
  const videoCount = materials.filter(
    (material) => material.materialType === "Video",
  ).length;

  const readingCount = materials.filter(
    (material) => material.materialType === "Reading",
  ).length;

  const requiredCount = materials.filter(
    (material) => material.isRequired,
  ).length;

  // Một file có thể được nhiều Material tham chiếu.
  // Chỉ cộng mỗi fileId một lần.
  const countedFiles = new Set<string>();
  let totalSizeBytes = 0n;

  for (const material of materials) {
    if (!countedFiles.has(material.fileId)) {
      countedFiles.add(material.fileId);
      totalSizeBytes += toBytes(material.file.sizeBytes);
    }
  }

  return (
    <>
      <div className="uc17-lesson-context">
        <span>
          Khóa học: <strong>{data.course.name}</strong>
        </span>

        <span>
          Chương: <strong>{data.module.title}</strong>
        </span>

        <span>
          Bài học: <strong>{data.lesson.title}</strong>
        </span>
      </div>

      {/* Thống kê danh sách học liệu */}
      <div className="uc17-stats">
        <div className="uc17-stat">
          <span>Tổng số học liệu</span>
          <strong>{materials.length}</strong>
        </div>

        <div className="uc17-stat">
          <span>Video / Tài liệu đọc</span>
          <strong>
            {videoCount} / {readingCount}
          </strong>
        </div>

        <div className="uc17-stat">
          <span>Học liệu bắt buộc</span>
          <strong>{requiredCount}</strong>
        </div>

        <div className="uc17-stat">
          <span>Dung lượng tệp đính kèm</span>
          <strong>{formatBytes(totalSizeBytes)}</strong>
        </div>
      </div>

      {/* Bảng danh sách */}
      <section className="uc17-table-card">
        <div className="uc17-table-header">
          <div>
            <h2>Học liệu</h2>
            <p>
              Danh sách video và tài liệu đọc của bài học, được sắp xếp theo thứ tự đã thiết lập.
            </p>
          </div>

          <span className="uc17-item-count">{materials.length} items</span>
        </div>

        <Table<IInstructorLessonMaterial>
          rowKey="id"
          columns={columnsWithActions}
          dataSource={materials}
          pagination={false}
          size="middle"
          scroll={{ x: 940 }}
          locale={{
            emptyText: "Bài học này chưa có học liệu.",
          }}
        />
      </section>

      <div className="uc17-storage-note">
        <FileTextOutlined />
        <p>
          Dung lượng đính kèm được tính từ các tệp riêng biệt mà bài học tham chiếu, không phải tổng dung lượng gói dịch vụ của tổ chức.
        </p>
      </div>
    </>
  );
};

const CourseBuilderMaterials = () => {
  const { courseId = "", lessonId = "" } = useParams();
  const navigate = useNavigate();

  const detailUrl = `/instructor/courses/${courseId}/builder/lessons/${lessonId}`;
  const videoAddUrl = `${detailUrl}/materials/video/new`;
  const readingAddUrl = `${detailUrl}/materials/reading/new`;
  // Dùng API thật đã có từ UC16.
  const query = useApiQuery(
    async (signal) => {
      if (!courseId || !lessonId) {
        throw new Error("Thiếu mã khóa học hoặc bài học.");
      }

      const response = await fetchCourseLessonDetailAPI(
        courseId,
        lessonId,
        signal,
      );

      if (!response.data) {
        throw new Error(
          response.message || "Không thể tải danh sách học liệu.",
        );
      }

      return response.data;
    },
    [courseId, lessonId],
  );

  return (
    <div className="uc17-materials-page">
      <div className="uc17-page-header">
        <div>
          <span className="uc17-eyebrow">
            Xây dựng khóa học / Bài học / Học liệu
          </span>

          <h1>Học liệu</h1>
          <p>Xem danh sách học liệu, yêu cầu bắt buộc và dung lượng đã sử dụng.</p>
        </div>

        <InstructorButton
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(detailUrl)}
        >
          Quay lại bài học
        </InstructorButton>
      </div>

      {query.status === "loading" && (
        <div className="uc17-loading">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      )}

      {query.status === "error" && (
        <div className="uc17-error">
          <Alert
            type="error"
            showIcon
            message={
              query.error.status === 404
                ? "Không tìm thấy bài học"
                : "Không thể tải học liệu"
            }
            description={
              query.error.status === 404
                ? "Bài học không tồn tại hoặc bạn không có quyền truy cập."
                : "Vui lòng kiểm tra kết nối và thử lại."
            }
          />

          <InstructorButton onClick={query.reload}>Thử lại</InstructorButton>
        </div>
      )}

      {query.status === "success" && (
        <>
          <div className="uc17-material-actions">
            <InstructorButton
              type="primary"
              icon={<VideoCameraOutlined />}
              onClick={() => navigate(videoAddUrl)}
            >
              Thêm video
            </InstructorButton>
            <InstructorButton onClick={() => navigate(readingAddUrl)}>
              Thêm tài liệu đọc
            </InstructorButton>
          </div>

          <MaterialsContent data={query.data} />
        </>
      )}
    </div>
  );
};

export default CourseBuilderMaterials;
