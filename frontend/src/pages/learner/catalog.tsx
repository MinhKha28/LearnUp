import { SearchOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { catalogCourseDetails } from "@/components/learner/learner.data";
import {
  CourseIconTile,
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatusTag,
} from "@/components/learner/learner.ui";
import "./catalog.scss";

const catalogCourses = Object.values(catalogCourseDetails);

const Catalog = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const results = useMemo(
    () =>
      catalogCourses.filter((course) =>
        `${course.title} ${course.description}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [search],
  );

  const hasResults = results.length > 0;

  return (
    <LearnerPage className="learner-catalog">
      <PageHeader
        eyebrow="LEARNER"
        title="Course Catalog"
        subtitle={
          hasResults
            ? "Discover Public Courses published by your Organization."
            : "No published Public Course matches your search."
        }
      />
      <Input
        className="learner-catalog-search"
        prefix={<SearchOutlined />}
        placeholder="Search by Course name or learning objective"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        allowClear
      />
      {hasResults ? (
        <>
          <h2 className="learner-catalog-section-title">Available Courses</h2>
          <div className="learner-catalog-grid">
            {results.map((course) => (
              <div className="learner-catalog-card" key={course.title}>
                <div className="learner-catalog-card-media">
                  <CourseIconTile />
                </div>
                <StatusTag tone="info">Public Course</StatusTag>
                <strong>{course.title}</strong>
                <p>{course.description}</p>
                <span className="learner-catalog-duration">
                  Estimated duration [Configured]
                </span>
                <LearnerButton block onClick={() => navigate(`/learner/catalog/${course.id}`)}>
                  View Course
                </LearnerButton>
              </div>
            ))}
          </div>
        </>
      ) : (
        // Empty/no-results state — mirrors 07_LEARNER_Catalog_No_Results.
        // "Clear search" resets the controlled search field above so the
        // grid re-populates; a later batch can wire this to real filtering.
        <div className="learner-catalog-empty">
          <span className="learner-catalog-empty-icon">
            <SearchOutlined />
          </span>
          <h3>No matching Courses</h3>
          <p>Try another Course name or learning objective.</p>
          <LearnerButton onClick={() => setSearch("")}>Clear search</LearnerButton>
        </div>
      )}
    </LearnerPage>
  );
};

export default Catalog;
