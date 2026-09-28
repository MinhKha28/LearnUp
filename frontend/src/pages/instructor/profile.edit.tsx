import { useRef, useState } from "react";
import { Avatar, Form, Input, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useCurrentApp } from "@/components/context/app.context";
import { InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./profile.edit.scss";

type ProfileFields = { fullName: string };

const ProfileEdit = () => {
  const { user, setUser } = useCurrentApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<ProfileFields>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(user?.avatar);
  const name = user?.fullName || "Jordan Chen";
  const email = user?.email || "jordan.chen@example.com";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function changePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setAvatar(URL.createObjectURL(file));
  }

  function submit(values: ProfileFields) {
    if (user) {
      setUser({ ...user, fullName: values.fullName, avatar });
    }
    message.success("Profile updated.");
    navigate("/instructor/profile");
  }

  return (
    <InstructorPage className="instructor-profile-edit">
      <PageHeader
        eyebrow="ACCOUNT / EDIT PROFILE"
        title="Edit Profile"
        subtitle="Update your name and avatar."
        back
      />
      <SectionCard>
        <div className="instructor-edit-photo-row">
          <Avatar size={64} src={avatar}>
            {initials}
          </Avatar>
          <input
            ref={fileInputRef}
            className="instructor-edit-photo-input"
            type="file"
            accept="image/*"
            onChange={changePhoto}
          />
          <InstructorButton onClick={() => fileInputRef.current?.click()}>Change photo</InstructorButton>
        </div>
        <Form<ProfileFields>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ fullName: name }}
          onFinish={submit}
        >
          <Form.Item
            label="Full name"
            name="fullName"
            rules={[{ required: true, whitespace: true, message: "Enter your full name." }]}
          >
            <Input autoComplete="name" />
          </Form.Item>
          <Form.Item label="Email address (read only)">
            <Input value={email} disabled />
          </Form.Item>
          <p className="instructor-edit-note">The login email cannot be self-edited.</p>
          <div className="instructor-edit-actions">
            <InstructorButton type="primary" htmlType="submit">
              Save changes
            </InstructorButton>
          </div>
        </Form>
      </SectionCard>
    </InstructorPage>
  );
};

export default ProfileEdit;
