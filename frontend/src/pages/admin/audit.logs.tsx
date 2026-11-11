import AuditLogView from "@/components/audit/audit.log.view";
import { AdminPage, PageHeader, SectionCard } from "@/components/admin/admin.ui";

/** UC51 - Xem nhật ký nền tảng (Admin): the platform actions and the actions on every Organization. */
const AdminAuditLogs = () => (
  <AdminPage className="admin-audit-logs">
    <PageHeader
      title="Nhật ký nền tảng"
      subtitle="Các hành động ở cấp nền tảng và các hành động tác động lên tổ chức."
    />
    <SectionCard>
      <AuditLogView showOrganization />
    </SectionCard>
  </AdminPage>
);

export default AdminAuditLogs;
