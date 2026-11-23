import AuditLogView from "@/components/audit/audit.log.view";
import { OrganizerPage, PageHeader, SectionCard } from "@/components/organizer/organizer.ui";

/** UC50 - Xem nhật ký tổ chức (Organizer): audit-service only returns the entries of the own Organization. */
const OrganizerAuditLogs = () => (
  <OrganizerPage className="organizer-audit-logs">
    <PageHeader title="Nhật ký tổ chức" subtitle="Các hành động đã được ghi nhận trong tổ chức của bạn." />
    <SectionCard>
      <AuditLogView />
    </SectionCard>
  </OrganizerPage>
);

export default OrganizerAuditLogs;
