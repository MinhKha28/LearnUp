import { ArrowLeftOutlined } from "@ant-design/icons";
import { Layout } from "antd";
import { Link, Outlet } from "react-router-dom";

import { DevIdentitySwitcher } from "@/components/learner/dev.identity.switcher";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import "./layout.learner.course.scss";

const LayoutLearnerCourse = () => (
  <Layout className="learner-course-layout">
    <Layout.Header className="learner-course-topbar">
      <Link className="learner-course-back" to={LEARNER_ROUTES.myCourses()}>
        <ArrowLeftOutlined aria-hidden="true" />
        <span>Khóa học của tôi</span>
      </Link>
      <DevIdentitySwitcher />
    </Layout.Header>
    <Layout.Content className="learner-course-main">
      <Outlet />
    </Layout.Content>
  </Layout>
);

export default LayoutLearnerCourse;
