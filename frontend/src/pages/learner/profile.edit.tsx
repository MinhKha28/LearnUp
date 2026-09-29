import { useRef, useState } from "react";
import { Avatar, Form, Input, message } from "antd";
import { useNavigate } from "react-router-dom";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  SectionCard,
} from "@/components/learner/learner.ui";
import { useCurrentApp } from "@/components/context/app.context";
import "./profile.edit.scss";

type ProfileFields = { fullName: string };

const ProfileEdit = () => {
  const { user, setUser } = useCurrentApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<ProfileFields>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(user?.avatar);
  const name = user?.fullName || "Alex Morgan";
  const email = user?.email || "alex.morgan@example.com";
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
    navigate("/learner/profile");
  }

  return (
    <LearnerPage className="learner-profile-edit">
      <PageHeader
        eyebrow="ACCOUNT / EDIT PROFILE"
        title="Edit Profile"
        subtitle="Update your name and avatar."
        back
      />
      <SectionCard>
        <div className="learner-edit-photo-row">
          <Avatar size={64} src={avatar}>
            {initials}
          </Avatar>
          <input
            ref={fileInputRef}
            className="learner-edit-photo-input"
            type="file"
            accept="image/*"
            onChange={changePhoto}
          />
          <LearnerButton onClick={() => fileInputRef.current?.click()}>
            Change photo
          </LearnerButton>
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
          <p className="learner-edit-note">Your email address cannot be edited here.</p>
          <div className="learner-edit-actions">
            <LearnerButton type="primary" htmlType="submit">
              Save changes
            </LearnerButton>
          </div>
        </Form>
      </SectionCard>
    </LearnerPage>
  );
};

export default ProfileEdit;
