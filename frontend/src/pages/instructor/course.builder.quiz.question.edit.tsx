import { CheckOutlined } from "@ant-design/icons";
import { Input, Radio, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderQuiz,
  findBuilderQuizQuestion,
  findCourseStructure,
  findInstructorCourse,
  removeBuilderQuizQuestion,
  saveBuilderQuizQuestion,
  slugify,
  type IBuilderQuizOption,
  type QuizQuestionType,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, WarningPanel } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

const typeOptions: { value: QuizQuestionType; label: string }[] = [
  { value: "single", label: "Một đáp án đúng" },
  { value: "multiple", label: "Nhiều đáp án đúng" },
  { value: "true-false", label: "Đúng / Sai" },
];

const defaultOptionsFor = (type: QuizQuestionType): IBuilderQuizOption[] => {
  if (type === "true-false") {
    return [
      { id: slugify("true"), text: "Đúng", correct: true },
      { id: slugify("false"), text: "Sai", correct: false },
    ];
  }
  return [
    { id: slugify("option-a"), text: "Thực hiện đúng quy trình", correct: true },
    { id: slugify("option-b"), text: "Bỏ qua các bước kiểm tra bắt buộc", correct: false },
    { id: slugify("option-c"), text: "Không làm theo hướng dẫn", correct: false },
  ];
};

const CourseBuilderQuizQuestionEdit = () => {
  const { courseId, quizId, questionId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const quiz = structure ? findBuilderQuiz(structure, quizId) : undefined;
  const existing = quiz ? findBuilderQuizQuestion(quiz, questionId) : undefined;

  const [type, setType] = useState<QuizQuestionType>(existing?.type ?? "single");
  const [text, setText] = useState(existing?.text ?? "Những hành động nào tuân thủ đúng quy trình?");
  const [options, setOptions] = useState<IBuilderQuizOption[]>(
    existing?.options ?? defaultOptionsFor("single"),
  );

  if (!course || !structure || !quiz) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  if (quiz.locked) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Xây dựng khóa học / Câu hỏi bị khóa</span>
        <div className="builder-hero">
          <h1>Không thể chỉnh sửa câu hỏi trắc nghiệm</h1>
        </div>
        <div className="builder-banner">
          <strong>Câu hỏi và đáp án đã bị khóa</strong>
          <p>Đã có ít nhất một học viên làm bài trắc nghiệm này.</p>
        </div>
        <div className="builder-update-card">
          <h2>Cấu hình bài trắc nghiệm</h2>
          <p className="builder-lesson-intro">Không thể chỉnh sửa câu hỏi hoặc đáp án.</p>
          <p className="builder-lesson-intro">Thời gian làm bài, số lượt làm n và thời gian khóa m giờ cũng không thể thay đổi.</p>
          <p className="builder-lesson-intro">
            Điểm đạt và trạng thái bắt buộc không thể thay đổi khi khóa học đã khóa.
          </p>
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/quizzes/${quiz.id}`)}>Quay lại</InstructorButton>
            <InstructorButton
              type="primary"
              onClick={() =>
                navigate(`/instructor/courses/${course.id}/edit`, { state: { newVersion: true } })
              }
            >
              Tạo phiên bản khóa học mới
            </InstructorButton>
          </div>
        </div>
      </InstructorPage>
    );
  }

  const changeType = (nextType: QuizQuestionType) => {
    setType(nextType);
    setOptions(defaultOptionsFor(nextType));
  };

  const toggleCorrect = (optionId: string) => {
    setOptions((current) =>
      current.map((option) => {
        if (type === "multiple") {
          return option.id === optionId ? { ...option, correct: !option.correct } : option;
        }
        return { ...option, correct: option.id === optionId };
      }),
    );
  };

  const updateOptionText = (optionId: string, value: string) => {
    setOptions((current) =>
      current.map((option) => (option.id === optionId ? { ...option, text: value } : option)),
    );
  };

  const addOption = () => {
    const letter = String.fromCharCode(65 + options.length);
    setOptions((current) => [
      ...current,
      { id: slugify(`option-${letter}`), text: "", correct: false },
    ]);
  };

  const handleSave = () => {
    if (!text.trim()) {
      message.warning("Nhập nội dung câu hỏi.");
      return;
    }
    if (options.some((option) => !option.text.trim())) {
      message.warning("Mỗi đáp án phải có nội dung.");
      return;
    }
    if (!options.some((option) => option.correct)) {
      message.warning("Chọn ít nhất một đáp án đúng.");
      return;
    }
    saveBuilderQuizQuestion(quiz, {
      id: existing?.id ?? slugify("question"),
      type,
      text: text.trim(),
      options,
    });
    message.success("Đã lưu câu hỏi.");
    navigate(`${base}/quizzes/${quiz.id}`);
  };

  const handleDelete = () => {
    if (!existing) return;
    removeBuilderQuizQuestion(quiz, existing.id);
    message.success("Đã xóa câu hỏi.");
    navigate(`${base}/quizzes/${quiz.id}`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Chỉnh sửa câu hỏi</span>
      <div className="builder-hero">
        <h1>Chỉnh sửa câu hỏi trắc nghiệm</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <label className="instructor-form-label instructor-form-label-spaced">Loại câu hỏi</label>
          <Radio.Group
            className="builder-question-type-toggle"
            aria-label="Loại câu hỏi"
            optionType="button"
            buttonStyle="solid"
            value={type}
            onChange={(event) => changeType(event.target.value as QuizQuestionType)}
            options={typeOptions}
          />

          <label className="instructor-form-label instructor-form-label-spaced">Câu hỏi</label>
          <Input value={text} onChange={(event) => setText(event.target.value)} />

          <label className="instructor-form-label instructor-form-label-spaced">Các phương án trả lời</label>
          <div className="builder-quiz-options">
            {options.map((option, index) => (
              <button
                type="button"
                key={option.id}
                className={`builder-quiz-option${option.correct ? " builder-quiz-option-correct" : ""}`}
                onClick={() => toggleCorrect(option.id)}
              >
                {option.correct && <CheckOutlined aria-label="Đáp án đúng" className="builder-quiz-option-check" />}
                {type === "true-false" ? (
                  <span>{option.text}</span>
                ) : (
                  <Input
                    variant="borderless"
                    value={option.text}
                    prefix={`${String.fromCharCode(65 + index)}.`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => updateOptionText(option.id, event.target.value)}
                  />
                )}
              </button>
            ))}
          </div>
          {type !== "true-false" && (
            <div className="builder-actions builder-actions-split">
              <InstructorButton onClick={addOption}>+ Thêm phương án</InstructorButton>
              {existing && (
                <button type="button" className="builder-table-link builder-table-link-danger" onClick={handleDelete}>
                  Xóa câu hỏi
                </button>
              )}
            </div>
          )}
          <div className="builder-actions">
            {type === "true-false" && existing && (
              <button
                type="button"
                className="builder-table-link builder-table-link-danger"
                onClick={handleDelete}
                style={{ marginRight: "auto" }}
              >
                Xóa câu hỏi
              </button>
            )}
            <InstructorButton onClick={() => navigate(`${base}/quizzes/${quiz.id}`)}>Hủy</InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Lưu câu hỏi
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <WarningPanel title="Khóa chỉnh sửa câu hỏi">
            Câu hỏi và đáp án sẽ bị khóa sau lượt làm bài trắc nghiệm đầu tiên.
          </WarningPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizQuestionEdit;
