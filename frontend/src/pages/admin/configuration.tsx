import { Form, InputNumber, Select } from "antd";
import { AdminButton, AdminPage, PageHeader, SectionCard } from "@/components/admin/admin.ui";
import "./configuration.scss";

const Configuration = () => <AdminPage className="admin-configuration">
  <PageHeader title="Platform Configuration" subtitle="Parameters apply across all Organizations." actions={<AdminButton type="primary" htmlType="submit" form="configuration-form">Save changes</AdminButton>} />
  <Form id="configuration-form" className="admin-form" layout="vertical" initialValues={{ grace: 48, invitation: 100, warning1: 7, warning2: 30, warning3: 60, estimation1: 100, estimation2: 1, estimation3: 20, moderation1: 8, moderation2: 3, moderation3: 7, review1: 7, review2: 24, questions: 5, time: 15, fileSize: 500, video: 120 }}>
    <div className="admin-configuration-grid">
      <SectionCard title="Subscription lifecycle"><Field name="grace" label="Grace period" unit="hours" /><Field name="warning1" label="First renewal warning" unit="days" /><Field name="warning2" label="Second renewal warning" unit="days" /><Field name="warning3" label="Final renewal warning" unit="days" /></SectionCard>
      <SectionCard title="Learning estimation"><Field name="invitation" label="Words per minute" unit="words/min" /><Field name="estimation2" label="Video minimum" unit="hour" /><Field name="estimation3" label="Assessment buffer" unit="%" /></SectionCard>
      <SectionCard title="Moderation & escalation"><Field name="moderation1" label="Organizer response time" unit="days" /><Field name="moderation2" label="Escalation warning" unit="days" /><Field name="moderation3" label="Escalation deadline" unit="days" /></SectionCard>
      <SectionCard title="Peer Review defaults"><Field name="review1" label="Review due" unit="days" /><Field name="review2" label="Reminder before due" unit="hours" /></SectionCard>
      <SectionCard title="Assessment defaults"><Field name="questions" label="Questions per quiz" unit="questions" /><Field name="time" label="Default duration" unit="minutes" /></SectionCard>
      <SectionCard title="Learning resource upload"><Field name="fileSize" label="File size limit" unit="MB" /><Field name="video" label="Video duration limit" unit="minutes" /></SectionCard>
    </div>
  </Form>
  <div className="admin-config-warning">Configuration changes apply only to data created afterward; recorded states, results and deadlines are not recalculated.</div>
</AdminPage>;

const Field = ({ name, label, unit }: { name: string; label: string; unit: string }) => <Form.Item name={name} label={label}><div className="admin-config-field"><InputNumber min={0} /><Select value={unit} options={[{ value: unit, label: unit }]} /></div></Form.Item>;
export default Configuration;
