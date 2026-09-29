import { DatePicker, Dropdown, Input, Modal } from "antd";
import { useState } from "react";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./assignment.detail.scss";

const AssignmentDetail = () => {
  const [extendOpen, setExtendOpen] = useState(false);
  const [exemptOpen, setExemptOpen] = useState(false);
  return (
    <OrganizerPage className="organizer-assignment-detail">
      <PageHeader
        title="Assignment detail"
        subtitle="Minh Le • Workplace Safety Essentials"
        back
        actions={
          <>
            <OrganizerButton onClick={() => setExtendOpen(true)}>
              Extend due date
            </OrganizerButton>
            <Dropdown
              menu={{
                items: [
                  { key: "exempt", label: "Mark Exempt", onClick: () => setExemptOpen(true) },
                  { key: "remove-exempt", label: "Remove Exempt" },
                  { key: "cancel", label: "Cancel assignment", danger: true },
                ],
              }}
            >
              <OrganizerButton>More actions</OrganizerButton>
            </Dropdown>
          </>
        }
      />
      <SectionCard title="Required Enrollment">
        <div className="organizer-metric-row">
          <div className="organizer-metric">
            <span>Assigned</span>
            <strong>16 Sep 2026</strong>
          </div>
          <div className="organizer-metric">
            <span>Due</span>
            <strong>30 Sep 2026</strong>
          </div>
          <div className="organizer-metric">
            <span>Progress</span>
            <strong>68%</strong>
          </div>
          <div className="organizer-metric">
            <span>Status</span>
            <strong>In progress</strong>
          </div>
          <div className="organizer-metric">
            <span>Type</span>
            <strong>Required</strong>
          </div>
        </div>
        <div className="organizer-assignment-detail-note">
          Due date can only be extended, never shortened after publication.
        </div>
      </SectionCard>
      <div className="organizer-content-grid organizer-assignment-detail-grid">
        <SectionCard title="Learning activity">
          <div className="organizer-detail-grid">
            <div className="organizer-detail-item">
              <span>Required resources completed</span>
              <strong>8 / 12</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Required Quizzes passed</span>
              <strong>2 / 3</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Assignments passed</span>
              <strong>1 / 2</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Peer Review obligation</span>
              <strong>Pending</strong>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Organizer actions">
          <div className="organizer-assignment-actions">
            <div>
              <strong>Cancel assignment</strong>
              <span>Only if no learning data exists.</span>
            </div>
            <div>
              <strong>Mark Exempt</strong>
              <span>Used after learning data exists; excluded from overdue stats.</span>
            </div>
            <div>
              <strong>Remove Exempt</strong>
              <span>Only for Exempt status set by Organizer.</span>
            </div>
          </div>
        </SectionCard>
      </div>
      <Modal
        className="organizer-extend-due-date-modal"
        open={extendOpen}
        centered
        title="Extend due date"
        onCancel={() => setExtendOpen(false)}
        footer={
          <>
            <OrganizerButton onClick={() => setExtendOpen(false)}>Cancel</OrganizerButton>
            <OrganizerButton type="primary" onClick={() => setExtendOpen(false)}>
              Extend due date
            </OrganizerButton>
          </>
        }
      >
        <div className="organizer-detail-item organizer-modal-detail-item">
          <span>Current due date</span>
          <strong>30 Sep 2026</strong>
        </div>
        <p className="organizer-note organizer-modal-note">New due date</p>
        <DatePicker style={{ width: "100%" }} />
        <WarningPanel title="Only extension is allowed; shortening is blocked.">
          Overdue status will be recalculated.
        </WarningPanel>
      </Modal>
      <Modal
        className="organizer-mark-exempt-modal"
        open={exemptOpen}
        centered
        title="Mark Enrollment as Exempt"
        onCancel={() => setExemptOpen(false)}
        footer={
          <>
            <OrganizerButton onClick={() => setExemptOpen(false)}>Cancel</OrganizerButton>
            <OrganizerButton type="primary" onClick={() => setExemptOpen(false)}>
              Mark Exempt
            </OrganizerButton>
          </>
        }
      >
        <p className="organizer-note organizer-mark-exempt-context">
          Minh Le • Workplace Safety Essentials
        </p>
        <p className="organizer-note organizer-modal-note">Reason</p>
        <Input.TextArea
          rows={3}
          defaultValue="Operational exemption approved by management."
        />
        <WarningPanel title="Exempt Enrollment is excluded from overdue statistics.">
          The Learner may continue accessing the Course.
        </WarningPanel>
      </Modal>
    </OrganizerPage>
  );
};

export default AssignmentDetail;
