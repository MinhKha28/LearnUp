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
    return <StatusTag tone="error">File released</StatusTag>;
  }

  if (material.disabledAt) {
    return <StatusTag tone="error">Disabled</StatusTag>;
  }

  if (material.file.status !== "Ready") {
    return <StatusTag tone="warning">{material.file.status}</StatusTag>;
  }

  return <StatusTag tone="success">Ready</StatusTag>;
};

// Các cột của bảng UC17.
const columns: ColumnsType<IInstructorLessonMaterial> = [
  {
    title: "Order",
    dataIndex: "position",
    key: "position",
    width: 78,
    align: "center",
  },
  {
    title: "Learning material",
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
    title: "Type",
    dataIndex: "materialType",
    key: "type",
    width: 115,
    render: (type: string) => <StatusTag tone="neutral">{type}</StatusTag>,
  },
  {
    title: "Requirement",
    key: "required",
    width: 135,
    render: (_, material) => (
      <StatusTag tone={material.isRequired ? "warning" : "neutral"}>
        {material.isRequired ? "Required" : "Optional"}
      </StatusTag>
    ),
  },
  {
    title: "File size",
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
    title: "Status",
    key: "status",
    width: 130,
    render: (_, material) => <MaterialStatus material={material} />,
  },
];

// Hiển thị nội dung khi đã nhận dữ liệu thành công.
const MaterialsContent = ({ data }: { data: IInstructorLessonDetail }) => {
  const materials = data.materials;

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
          Course: <strong>{data.course.name}</strong>
        </span>

        <span>
          Module: <strong>{data.module.title}</strong>
        </span>

        <span>
          Lesson: <strong>{data.lesson.title}</strong>
        </span>
      </div>

      {/* Thống kê danh sách học liệu */}
      <div className="uc17-stats">
        <div className="uc17-stat">
          <span>Total materials</span>
          <strong>{materials.length}</strong>
        </div>

        <div className="uc17-stat">
          <span>Videos / Readings</span>
          <strong>
            {videoCount} / {readingCount}
          </strong>
        </div>

        <div className="uc17-stat">
          <span>Required materials</span>
          <strong>{requiredCount}</strong>
        </div>

        <div className="uc17-stat">
          <span>Attached file size</span>
          <strong>{formatBytes(totalSizeBytes)}</strong>
        </div>
      </div>

      {/* Bảng danh sách */}
      <section className="uc17-table-card">
        <div className="uc17-table-header">
          <div>
            <h2>Learning materials</h2>
            <p>
              Videos and readings belonging to this Lesson, ordered by their
              configured position.
            </p>
          </div>

          <span className="uc17-item-count">{materials.length} items</span>
        </div>

        <Table<IInstructorLessonMaterial>
          rowKey="id"
          columns={columns}
          dataSource={materials}
          pagination={false}
          size="middle"
          scroll={{ x: 940 }}
          locale={{
            emptyText: "No learning materials have been added to this Lesson.",
          }}
        />
      </section>

      <div className="uc17-storage-note">
        <FileTextOutlined />
        <p>
          Attached file size is calculated from the distinct files referenced by
          this Lesson. It is not the organization's Subscription storage usage.
        </p>
      </div>
    </>
  );
};

const CourseBuilderMaterials = () => {
  const { courseId = "", lessonId = "" } = useParams();
  const navigate = useNavigate();

  const detailUrl = `/instructor/courses/${courseId}/builder/lessons/${lessonId}`;

  // Dùng API thật đã có từ UC16.
  const query = useApiQuery(
    async (signal) => {
      if (!courseId || !lessonId) {
        throw new Error("Course ID or Lesson ID is missing.");
      }

      const response = await fetchCourseLessonDetailAPI(
        courseId,
        lessonId,
        signal,
      );

      if (!response.data) {
        throw new Error(
          response.message || "Unable to load learning materials.",
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
            COURSE BUILDER / LESSON / MATERIALS
          </span>

          <h1>Learning Materials</h1>
          <p>View learning materials, requirements and occupied file sizes.</p>
        </div>

        <InstructorButton
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(detailUrl)}
        >
          Back to Lesson
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
                ? "Lesson not found"
                : "Unable to load learning materials"
            }
            description={
              query.error.status === 404
                ? "The Lesson does not exist or you do not have access."
                : "Please check your connection and try again."
            }
          />

          <InstructorButton onClick={query.reload}>Try again</InstructorButton>
        </div>
      )}

      {query.status === "success" && <MaterialsContent data={query.data} />}
    </div>
  );
};

export default CourseBuilderMaterials;
