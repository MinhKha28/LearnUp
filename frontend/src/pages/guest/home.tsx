import { Link, useNavigate } from "react-router-dom";
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
import "@/pages/guest/home.scss";

const capabilities = [
  {
    title: "Course governance",
    icon: <BookOutlined />,
    text: "Draft, review and publish Course versions with clear ownership.",
  },
  {
    title: "People and assignments",
    icon: <TeamOutlined />,
    text: "Invite members and assign required Courses to selected Learners.",
  },
  {
    title: "Assessments and grading",
    icon: <FileDoneOutlined />,
    text: "Run Quizzes, Assignments and Peer Review with clear grading steps.",
  },
  {
    title: "Progress and certificates",
    icon: <SafetyCertificateOutlined />,
    text: "Monitor completion and issue Certificates when requirements are met.",
  },
];

const gettingStarted = [
  ["01", "Select a plan", "Compare capacity and duration."],
  ["02", "Register", "Enter Organization and Organizer details."],
  ["03", "Complete payment", "Use the mock payment service."],
  ["04", "Verify email", "Activate the Organizer account."],
];

const plans = [
  {
    name: "Team",
    description: "For focused training programs",
    price: "$149",
    priceNote: "for 90 days \u2022 demo pricing",
    limits: [
      ["Learner seats", "100"],
      ["Instructor seats", "10"],
      ["Courses", "25"],
      ["Storage", "100 GB"],
    ] as Array<[string, string]>,
    footer: "A practical starting point for one team.",
  },
  {
    name: "Growth",
    description: "For growing organizations",
    price: "$399",
    priceNote: "for 180 days \u2022 demo pricing",
    limits: [
      ["Learner seats", "300"],
      ["Instructor seats", "25"],
      ["Courses", "75"],
      ["Storage", "500 GB"],
    ] as Array<[string, string]>,
    footer: "Room for several departments and programs.",
  },
  {
    name: "Scale",
    description: "For larger training operations",
    price: "$1,199",
    priceNote: "for 365 days \u2022 demo pricing",
    limits: [
      ["Learner seats", "1,000"],
      ["Instructor seats", "80"],
      ["Courses", "250"],
      ["Storage", "2 TB"],
    ] as Array<[string, string]>,
    footer: "Capacity for more courses and learners.",
  },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <main className="home" id="guest-main">
      <section className="home-section home-hero" id="platform">
        <div className="home-hero-copy">
          <span className="home-eyebrow-pill">BUILT FOR ORGANIZATIONS</span>
          <h1>
            Training that helps
            <br />
            your organization
            <br />
            move forward.
          </h1>
          <p>
            Create structured courses, assign required learning and see where
            every team stands in one workspace.
          </p>
          <div className="home-actions">
            <Link className="guest-link guest-link-primary" to="/register">
              Explore plans <ArrowRightOutlined />
            </Link>
            <a className="guest-link" href="#how-it-works">
              See how it works <ArrowRightOutlined />
            </a>
          </div>
          <div className="home-lifecycle" aria-label="Training lifecycle">
            <span>COURSES</span>
            <ArrowRightOutlined />
            <span>ASSIGNMENTS</span>
            <ArrowRightOutlined />
            <span>RESULTS</span>
          </div>
        </div>

        <div className="home-preview" aria-label="LearnUP training overview preview">
          <div className="home-preview-bar">
            <span className="home-preview-dots" aria-hidden="true">
              <i /> <i /> <i />
            </span>
            <span>LearnUP / Training workspace</span>
          </div>
          <div className="home-preview-body">
            <aside>
              <img src="/logo/learnup-logo-dark.png" alt="" />
              {['Overview', 'People', 'Courses', 'Assignments', 'Reports'].map(
                (label, index) => (
                  <div
                    key={label}
                    className={index === 0 ? "home-preview-active" : undefined}
                  >
                    <span aria-hidden="true">{index === 0 ? "\u25CF" : "\u2022"}</span>
                    {label}
                  </div>
                ),
              )}
            </aside>
            <div className="home-preview-content">
              <h2>Training overview</h2>
              <p>Keep required learning on track.</p>
              <div className="home-preview-metrics">
                {[
                  ["24", "Courses"],
                  ["86%", "On-time progress"],
                  ["12", "To review"],
                ].map(([value, label], index) => (
                  <div key={label}>
                    <i className={`home-preview-metric-icon home-preview-metric-icon-${index}`} />
                    <b>{value}</b>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
              <div className="home-activity">
                <div className="home-activity-title">
                  <b>Course activity</b>
                </div>
                {[
                  ["Workplace Safety Essentials", "Published"],
                  ["Data Protection Basics", "In progress"],
                  ["Service Communication", "Draft"],
                ].map(([label, status], index) => (
                  <div className="home-activity-row" key={label}>
                    <span>{label}</span>
                    <span className={`home-activity-status home-activity-status-${index}`}>
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
          <h2>One connected training workflow</h2>
          <p>Give every role a clear place to create, learn and measure progress.</p>
        </div>
        <div>
          {['Create', 'Assign', 'Learn', 'Measure'].map((item, index) => (
            <span key={item}>
              <i>{index + 1}</i>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="home-section home-capability-section" id="capabilities">
        <span className="guest-eyebrow">CAPABILITIES</span>
        <h2>Everything your training team needs to keep learning moving</h2>
        <p>A structured workspace for people, courses and measurable progress.</p>
        <div className="home-capabilities">
          {capabilities.map((item, index) => (
            <article key={item.title}>
              <span className={`home-icon home-icon-${index}`}>{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <a href="#how-it-works">Explore capability</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-why">
        <div className="home-why-copy">
          <span className="guest-eyebrow">WHY LEARNUP</span>
          <h2>
            Keep internal training
            <br />
            clear and accountable.
          </h2>
          {[
            ["One place to coordinate", "Courses, people and required learning stay in a shared workflow."],
            ["Clear responsibilities", "Organizers assign; Instructors build and grade; Learners progress."],
            ["Progress you can act on", "Review completion, overdue training and assessment outcomes."],
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
          <span className="guest-eyebrow">LEARNING WORKSPACE</span>
          <h3>A clear path through every course</h3>
          <div className="home-course-card">
            <BookOutlined />
            <span>
              <b>Workplace Safety Essentials</b>
              <small>{"Course curriculum \u2022 demo"}</small>
            </span>
          </div>
          {[
            ["Module 01 \u2022 Safety foundations", "module"],
            ["Lesson \u2022 Safety at work", "lesson"],
            ["Quiz \u2022 Check your understanding", "quiz"],
            ["Assignment \u2022 Apply the procedure", "assignment"],
          ].map(([item, type], index) => (
            <div className="home-course-row" key={item}>
              <i className={`home-course-dot home-course-dot-${index}`} />
              <span>{item}</span>
              <small>{type}</small>
            </div>
          ))}
          <div className="home-course-progress">
            <span />
            <small>Learning progress</small>
          </div>
        </div>
      </section>

      <section className="home-section home-steps-section" id="how-it-works">
        <span className="guest-eyebrow">GETTING STARTED</span>
        <h2>From a plan to an active organization</h2>
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
            <span className="home-showcase-pill">FROM LEARNING TO RESULTS</span>
            <h2>
              Make progress visible.
              <br />
              Recognize completed learning.
            </h2>
            <p>
              Organizers follow assigned training and overdue work. Learners can
              earn a Certificate after meeting the Course completion requirements.
            </p>
          </div>
          <div className="home-certificate-card">
            <div>
              <FlagOutlined />
              <span>
                <b>Training progress</b>
                <small>Workplace Safety Essentials</small>
              </span>
            </div>
            <div>
              <TeamOutlined />
              <span>
                <b>Required learning</b>
                <small>Assigned learners and deadline tracking</small>
              </span>
            </div>
            <div className="home-certificate-award">
              <SafetyCertificateOutlined />
              <span>
                <b>Certificate of completion</b>
                <small>Issued when Course requirements are met</small>
                <em>{"LearnUP \u2022 Organization training"}</em>
              </span>
            </div>
          </div>
          <i className="home-showcase-shape home-showcase-shape-left" />
          <i className="home-showcase-shape home-showcase-shape-right" />
        </div>
      </section>

      <section className="home-section home-plans" id="plans">
        <span className="guest-eyebrow">SUBSCRIPTION PLANS</span>
        <h2>Find the right capacity for your organization</h2>
        <p>
          Illustrative plan data below. Availability, limits and prices are configured
          per the platform Admin.
        </p>
        <div className="guest-plan-grid">
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.name}
              home
              featured={index === 1}
              details={plan}
              onSelect={() => navigate("/register/organization")}
            />
          ))}
        </div>
      </section>

      <section className="home-cta">
        <div>
          <h2>Ready to organize training in one place?</h2>
          <p>Choose a plan and create a workspace for your organization.</p>
        </div>
        <Link className="guest-link guest-link-primary" to="/register">
          Explore plans <ArrowRightOutlined />
        </Link>
      </section>

      <section className="home-section home-before" id="before-you-start">
        <span className="guest-eyebrow">COMMON QUESTIONS</span>
        <h2>Before you get started</h2>
        <div>
          {[
            ["Who can register?", "A representative registers the Organization and activates an Organizer account."],
            ["How is payment handled?", "This project uses a mock payment service. The amount shown is illustrative."],
            ["Can team members use Google sign-in?", "Existing Organizer, Instructor and Learner accounts can sign in with Google."],
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
