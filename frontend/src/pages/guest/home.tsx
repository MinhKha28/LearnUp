import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Spin } from "antd";
import {
  ArrowRightOutlined,
  BookOutlined,
  CheckOutlined,
  FileDoneOutlined,
  FlagOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import PlanCard from "@/components/guest/registration/plan.card";
import { getSubscriptionPlansAPI } from "@/services/organization.service";
import type { ISubscriptionPlan } from "@/types/organization.types";
import { toPlanDetails } from "@/utils/helper";

import "@/pages/guest/home.scss";

const capabilities = [
  {
    title: "Quản lý khóa học",
    icon: <BookOutlined />,
    text: "Soạn, duyệt và xuất bản các phiên bản khóa học với người phụ trách rõ ràng.",
  },
  {
    title: "Thành viên và phân công đào tạo",
    icon: <TeamOutlined />,
    text: "Mời thành viên và phân công khóa học bắt buộc cho từng học viên.",
  },
  {
    title: "Đánh giá và chấm điểm",
    icon: <FileDoneOutlined />,
    text: "Tổ chức bài trắc nghiệm, bài tập và chấm chéo với các bước chấm rõ ràng.",
  },
  {
    title: "Tiến độ và chứng chỉ",
    icon: <SafetyCertificateOutlined />,
    text: "Theo dõi mức hoàn thành và cấp chứng chỉ khi đủ điều kiện.",
  },
];

const gettingStarted = [
  ["01", "Chọn gói", "So sánh giới hạn và thời hạn sử dụng."],
  ["02", "Đăng ký", "Khai thông tin tổ chức và quản lý đào tạo."],
  ["03", "Xác thực email", "Nhập mã gửi tới email của quản lý đào tạo."],
  ["04", "Thanh toán", "Thanh toán mô phỏng để kích hoạt tài khoản."],
];

export default function HomePage() {
  const navigate = useNavigate();

  // UC01: trang chủ cũng hiển thị gói thật từ tenant-service (BR-3: chỉ gói đang cung cấp)
  const [plans, setPlans] = useState<ISubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planError, setPlanError] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await getSubscriptionPlansAPI();
        if (res.data) setPlans(res.data);
        else setPlanError(true);
      } catch {
        setPlanError(true);
      } finally {
        setLoadingPlans(false);
      }
    };
    loadPlans();
  }, []);

  return (
    <main className="home" id="guest-main">
      <section className="home-section home-hero" id="platform">
        <div className="home-hero-copy">
          <span className="home-eyebrow-pill">Dành cho tổ chức</span>
          <h1>
            Đào tạo giúp
            <br />
            tổ chức của bạn
            <br />
            tiến xa hơn.
          </h1>
          <p>
            Xây dựng khóa học bài bản, phân công đào tạo bắt buộc và theo dõi
            tiến độ của mọi nhóm trong một không gian làm việc.
          </p>
          <div className="home-actions">
            <Link className="guest-link guest-link-primary" to="/register">
              Xem các gói <ArrowRightOutlined />
            </Link>
            <a className="guest-link" href="#how-it-works">
              Xem cách hoạt động <ArrowRightOutlined />
            </a>
          </div>
          <div className="home-lifecycle" aria-label="Vòng đời đào tạo">
            <span>Khóa học</span>
            <ArrowRightOutlined />
            <span>Phân công đào tạo</span>
            <ArrowRightOutlined />
            <span>Kết quả</span>
          </div>
        </div>

        <div
          className="home-preview"
          aria-label="Xem trước tổng quan đào tạo LearnUP"
        >
          <div className="home-preview-bar">
            <span className="home-preview-dots" aria-hidden="true">
              <i /> <i /> <i />
            </span>
            <span>LearnUP / Không gian đào tạo</span>
          </div>
          <div className="home-preview-body">
            <aside>
              <img src="/logo/learnup-logo-dark.png" alt="" />
              {[
                "Tổng quan",
                "Thành viên",
                "Khóa học",
                "Phân công đào tạo",
                "Báo cáo",
              ].map((label, index) => (
                <div
                  key={label}
                  className={index === 0 ? "home-preview-active" : undefined}
                >
                  <span aria-hidden="true">
                    {index === 0 ? "\u25CF" : "\u2022"}
                  </span>
                  {label}
                </div>
              ))}
            </aside>
            <div className="home-preview-content">
              <h2>Tổng quan đào tạo</h2>
              <p>Giữ đào tạo bắt buộc đúng tiến độ.</p>
              <div className="home-preview-metrics">
                {[
                  ["24", "Khóa học"],
                  ["86%", "Đúng tiến độ"],
                  ["12", "Cần duyệt"],
                ].map(([value, label], index) => (
                  <div key={label}>
                    <i
                      className={`home-preview-metric-icon home-preview-metric-icon-${index}`}
                    />
                    <b>{value}</b>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
              <div className="home-activity">
                <div className="home-activity-title">
                  <b>Hoạt động khóa học</b>
                </div>
                {[
                  ["An toàn lao động cơ bản", "Đã xuất bản"],
                  ["Bảo vệ dữ liệu cơ bản", "Đang biên soạn"],
                  ["Giao tiếp với khách hàng", "Bản nháp"],
                ].map(([label, status], index) => (
                  <div className="home-activity-row" key={label}>
                    <span>{label}</span>
                    <span
                      className={`home-activity-status home-activity-status-${index}`}
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-workflow-strip">
        <div>
          <h2>Một quy trình đào tạo liền mạch</h2>
          <p>
            Mỗi vai trò có chỗ riêng để xây dựng, học tập và đo lường tiến độ.
          </p>
        </div>
        <div>
          {["Xây dựng", "Phân công", "Học tập", "Đo lường"].map(
            (item, index) => (
              <span key={item}>
                <i>{index + 1}</i>
                {item}
              </span>
            ),
          )}
        </div>
      </section>

      <section
        className="home-section home-capability-section"
        id="capabilities"
      >
        <span className="guest-eyebrow">Tính năng</span>
        <h2>Mọi thứ nhóm đào tạo cần để việc học luôn tiến triển</h2>
        <p>
          Không gian làm việc bài bản cho thành viên, khóa học và tiến độ đo
          được.
        </p>
        <div className="home-capabilities">
          {capabilities.map((item, index) => (
            <article key={item.title}>
              <span className={`home-icon home-icon-${index}`}>
                {item.icon}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <a href="#how-it-works">Tìm hiểu thêm</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-why">
        <div className="home-why-copy">
          <span className="guest-eyebrow">Vì sao chọn LearnUP</span>
          <h2>
            Đào tạo nội bộ
            <br />
            rõ ràng và có trách nhiệm.
          </h2>
          {[
            [
              "Một nơi để điều phối",
              "khóa học, thành viên và đào tạo bắt buộc nằm chung một quy trình.",
            ],
            [
              "Trách nhiệm rõ ràng",
              "Quản lý đào tạo phân công; giảng viên xây dựng và chấm bài; học viên học tập.",
            ],
            [
              "Tiến độ để hành động",
              "Xem mức hoàn thành, các trường hợp quá hạn và kết quả đánh giá.",
            ],
          ].map(([title, text]) => (
            <div className="home-reason" key={title}>
              <CheckOutlined />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="home-course-map">
          <div className="home-course-orb" aria-hidden="true" />
          <span className="guest-eyebrow">Không gian học tập</span>
          <h3>Lộ trình rõ ràng cho mọi khóa học</h3>
          <div className="home-course-card">
            <BookOutlined />
            <span>
              <b>An toàn lao động cơ bản</b>
              <small>{"Chương trình khóa học \u2022 minh họa"}</small>
            </span>
          </div>
          {[
            ["Chương 01 \u2022 Nền tảng an toàn", "chương"],
            ["Bài học \u2022 An toàn khi làm việc", "bài học"],
            ["Bài trắc nghiệm \u2022 Kiểm tra hiểu biết", "bài trắc nghiệm"],
            ["Bài tập \u2022 Áp dụng quy trình", "bài tập"],
          ].map(([item, type], index) => (
            <div className="home-course-row" key={item}>
              <i className={`home-course-dot home-course-dot-${index}`} />
              <span>{item}</span>
              <small>{type}</small>
            </div>
          ))}
          <div className="home-course-progress">
            <span />
            <small>Tiến độ học tập</small>
          </div>
        </div>
      </section>

      <section className="home-section home-steps-section" id="how-it-works">
        <span className="guest-eyebrow">Bắt đầu</span>
        <h2>Từ chọn gói đến tổ chức hoạt động</h2>
        <div className="home-steps">
          {gettingStarted.map(([number, title, text]) => (
            <article key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="home-certificate-showcase">
          <div className="home-showcase-copy">
            <span className="home-showcase-pill">Từ học tập đến kết quả</span>
            <h2>
              Tiến độ luôn rõ ràng.
              <br />
              Ghi nhận việc học đã hoàn thành.
            </h2>
            <p>
              Quản lý đào tạo theo dõi đào tạo đã phân công và các trường hợp
              quá hạn. Học viên nhận chứng chỉ khi đáp ứng đủ điều kiện hoàn
              thành khóa học.
            </p>
          </div>
          <div className="home-certificate-card">
            <div>
              <FlagOutlined />
              <span>
                <b>Tiến độ đào tạo</b>
                <small>An toàn lao động cơ bản</small>
              </span>
            </div>
            <div>
              <TeamOutlined />
              <span>
                <b>Đào tạo bắt buộc</b>
                <small>
                  Học viên được phân công và theo dõi hạn hoàn thành
                </small>
              </span>
            </div>
            <div className="home-certificate-award">
              <SafetyCertificateOutlined />
              <span>
                <b>Chứng chỉ hoàn thành</b>
                <small>Cấp khi đủ điều kiện hoàn thành khóa học</small>
                <em>{"LearnUP \u2022 Đào tạo tổ chức"}</em>
              </span>
            </div>
          </div>
          <i className="home-showcase-shape home-showcase-shape-left" />
          <i className="home-showcase-shape home-showcase-shape-right" />
        </div>
      </section>

      <section className="home-section home-plans" id="plans">
        <span className="guest-eyebrow">Các gói</span>
        <h2>Chọn gói phù hợp với quy mô tổ chức</h2>
        <p>
          Các gói đang được cung cấp trên nền tảng. Giá được giữ nguyên từ lúc
          bạn đăng ký.
        </p>
        {loadingPlans && <Spin size="large" />}
        {planError && (
          <Alert
            type="error"
            showIcon
            message="Không tải được danh sách gói. Vui lòng thử lại sau."
          />
        )}
        {!loadingPlans && !planError && (
          <div className="guest-plan-grid">
            {plans.map((plan, index) => (
              <PlanCard
                key={plan.id}
                home
                featured={index === 1}
                details={toPlanDetails(plan)}
                onSelect={() =>
                  navigate("/register/organization", { state: { plan } })
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="home-cta">
        <div>
          <h2>Sẵn sàng quản lý đào tạo ở một nơi?</h2>
          <p>Chọn gói và tạo không gian làm việc cho tổ chức của bạn.</p>
        </div>
        <Link className="guest-link guest-link-primary" to="/register">
          Xem các gói <ArrowRightOutlined />
        </Link>
      </section>

      <section className="home-section home-before" id="before-you-start">
        <span className="guest-eyebrow">Câu hỏi thường gặp</span>
        <h2>Trước khi bắt đầu</h2>
        <div>
          {[
            [
              "Ai có thể đăng ký?",
              "Người đại diện đăng ký tổ chức và trở thành quản lý đào tạo sau khi thanh toán.",
            ],
            [
              "Thanh toán thế nào?",
              "Dự án dùng dịch vụ thanh toán mô phỏng. Số tiền hiển thị chỉ để minh họa.",
            ],
            [
              "Thành viên có đăng nhập bằng Google được không?",
              "Tài khoản quản lý đào tạo, giảng viên và học viên đã có có thể đăng nhập bằng Google.",
            ],
          ].map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
