import type {
  CourseTree,
  CourseTreeLesson,
  CourseTreeMaterial,
} from '../../infrastructure/clients/course/course-service.interface';

/** Một học liệu trong bản sao của phiên bản (material_snapshots). */
export interface SnapshotMaterial {
  materialId: string;
  lessonId: string;
  materialType: string;
  isRequired: boolean;
  disabledAt: Date | null;
}

/** Bản sao của phiên bản: học liệu và các Lesson có disabled_at trong lesson_snapshots. */
export interface CurriculumSnapshot {
  materials: SnapshotMaterial[];
  disabledLessonIds: ReadonlySet<string>;
}

export interface CurriculumMaterial {
  materialId: string;
  title: string;
  position: number;
  materialType: string;
  isRequired: boolean;
  durationSeconds: number | null;
  completed: boolean;
}

export interface CurriculumLesson {
  lessonId: string;
  title: string;
  position: number;
  isRequired: boolean;
  /** null: không có học liệu hiển thị, trạng thái trung tính (D30). */
  completed: boolean | null;
  materials: CurriculumMaterial[];
}

export interface CurriculumModule {
  moduleId: string;
  title: string;
  position: number;
  isRequired: boolean;
  completed: boolean | null;
  lessons: CurriculumLesson[];
}

/** Chỗ lệch giữa I2 và bản sao, để service ghi log; không làm hỏng response. */
export interface CurriculumDiscrepancies {
  /** Có trong I2, chưa có trong bản sao (thêm sau Locked): hiện là không bắt buộc, chưa hoàn thành. */
  onlyInTree: string[];
  /** Có trong bản sao, không có trong I2: bỏ qua. */
  onlyInSnapshot: string[];
  /** isRequired của I2 khác bản sao: dùng bản sao (BR-90). */
  requiredMismatch: string[];
}

export interface Curriculum {
  /** Chỉ Module còn Lesson hiển thị, theo position. */
  modules: CurriculumModule[];
  /** Lesson hiển thị theo thứ tự duyệt phẳng Module rồi Lesson, để tìm Lesson trước/sau (D32). */
  visibleLessons: CurriculumLesson[];
  /** Mọi Lesson có trong cây I2 của phiên bản, kể cả bị ẩn. */
  treeLessonIds: ReadonlySet<string>;
  discrepancies: CurriculumDiscrepancies;
}

const byPosition = <T extends { position: number }>(items: readonly T[]) =>
  [...items].sort((a, b) => a.position - b.position);

/**
 * Cây chương trình UC27, UC27.1 (D29, D30, D32). Hàm thuần: không I/O, không đọc đồng hồ.
 * Tiêu đề, thứ tự, thời lượng lấy từ I2; bắt buộc, loại, hoàn thành lấy từ bản sao và material_progress.
 * Thành phần bị ẩn khi I2 hoặc bản sao đánh dấu vô hiệu hóa (BR-243).
 * Lesson bắt buộc khi có học liệu hiển thị bắt buộc (BR-147); hoàn thành theo BR-306;
 * Lesson hoặc Module không có học liệu hiển thị có completed = null (D30).
 */
export function buildCurriculum(
  tree: CourseTree,
  snapshot: CurriculumSnapshot,
  completedMaterialIds: ReadonlySet<string>,
): Curriculum {
  const snapshotById = new Map(
    snapshot.materials.map((material) => [material.materialId, material]),
  );
  const discrepancies: CurriculumDiscrepancies = {
    onlyInTree: [],
    onlyInSnapshot: [],
    requiredMismatch: [],
  };
  const treeLessonIds = new Set<string>();
  const treeMaterialIds = new Set<string>();

  const toMaterial = (
    material: CourseTreeMaterial,
  ): CurriculumMaterial | null => {
    treeMaterialIds.add(material.id);
    const saved = snapshotById.get(material.id);
    if (!saved) {
      discrepancies.onlyInTree.push(material.id);
    } else if (saved.isRequired !== material.isRequired) {
      discrepancies.requiredMismatch.push(material.id);
    }
    if (material.disabledAt !== null || (saved && saved.disabledAt !== null)) {
      return null;
    }
    return {
      materialId: material.id,
      title: material.title,
      position: material.position,
      materialType: saved?.materialType ?? material.materialType,
      isRequired: saved?.isRequired ?? false,
      durationSeconds:
        material.materialType === 'Video' ? material.durationSeconds : null,
      completed: saved ? completedMaterialIds.has(material.id) : false,
    };
  };

  const toLesson = (lesson: CourseTreeLesson): CurriculumLesson | null => {
    treeLessonIds.add(lesson.id);
    // Duyệt mọi học liệu kể cả của Lesson bị ẩn, để chỗ lệch được báo đủ
    const materials = byPosition(lesson.materials)
      .map(toMaterial)
      .filter((material): material is CurriculumMaterial => material !== null);
    if (
      lesson.disabledAt !== null ||
      snapshot.disabledLessonIds.has(lesson.id)
    ) {
      return null;
    }

    const required = materials.filter((material) => material.isRequired);
    const isRequired = required.length > 0;
    const counted = isRequired ? required : materials;
    return {
      lessonId: lesson.id,
      title: lesson.title,
      position: lesson.position,
      isRequired,
      completed:
        materials.length === 0
          ? null
          : counted.every((material) => material.completed),
      materials,
    };
  };

  const modules: CurriculumModule[] = [];
  for (const module of byPosition(tree.modules)) {
    const lessons = byPosition(module.lessons)
      .map(toLesson)
      .filter((lesson): lesson is CurriculumLesson => lesson !== null);
    if (lessons.length === 0) {
      continue;
    }
    const required = lessons.filter((lesson) => lesson.isRequired);
    const withMaterials = lessons.filter((lesson) => lesson.completed !== null);
    const counted = required.length > 0 ? required : withMaterials;
    modules.push({
      moduleId: module.id,
      title: module.title,
      position: module.position,
      isRequired: required.length > 0,
      completed:
        withMaterials.length === 0
          ? null
          : counted.every((lesson) => lesson.completed === true),
      lessons,
    });
  }

  discrepancies.onlyInSnapshot = snapshot.materials
    .map((material) => material.materialId)
    .filter((id) => !treeMaterialIds.has(id));

  return {
    modules,
    visibleLessons: modules.flatMap((module) => module.lessons),
    treeLessonIds,
    discrepancies,
  };
}

/** Lesson trước và sau trong danh sách phẳng Lesson hiển thị (D32); null ở đầu, cuối hoặc khi không có. */
export function neighborLessons(
  curriculum: Curriculum,
  lessonId: string,
): {
  previous: CurriculumLesson | null;
  next: CurriculumLesson | null;
} {
  const lessons = curriculum.visibleLessons;
  const index = lessons.findIndex((lesson) => lesson.lessonId === lessonId);
  if (index === -1) {
    return { previous: null, next: null };
  }
  return {
    previous: lessons[index - 1] ?? null,
    next: lessons[index + 1] ?? null,
  };
}
