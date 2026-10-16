import { useEffect, useRef, type ComponentType } from "react";
import { Alert, Avatar, Form, Input, Spin, message, type ButtonProps } from "antd";
import { initialsOf, useMyProfile } from "@/hooks/use.my.profile";
import "./profile.editor.scss";

type ProfileFields = { fullName: string };

interface IProps {
  button: ComponentType<ButtonProps>;
  onSaved: () => void;
}

const ProfileEditor = ({ button: RoleButton, onSaved }: IProps) => {
  const [form] = Form.useForm<ProfileFields>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    profile,
    loading,
    saving,
    uploading,
    error,
    clearError,
    saveName,
    uploadAvatar,
    removeAvatar,
  } = useMyProfile();

  useEffect(() => {
    if (profile) form.setFieldsValue({ fullName: profile.fullName });
  }, [profile, form]);

  async function changePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && (await uploadAvatar(file))) message.success("Photo updated.");
  }

  async function submit(values: ProfileFields) {
    if (await saveName(values.fullName)) {
      message.success("Profile updated.");
      onSaved();
    }
  }

  if (loading) return <Spin />;

  return (
    <div className="profile-editor">
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          closable
          onClose={clearError}
        />
      )}
      <div className="profile-editor-photo">
        <Avatar size={64} src={profile?.avatarUrl ?? undefined}>
          {initialsOf(profile?.fullName)}
        </Avatar>
        <input
          ref={fileInputRef}
          className="profile-editor-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={changePhoto}
        />
        <RoleButton
          loading={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Change photo
        </RoleButton>
        {profile?.avatarUrl && (
          <RoleButton
            danger
            disabled={uploading}
            onClick={async () => {
              if (await removeAvatar()) message.success("Photo removed.");
            }}
          >
            Remove photo
          </RoleButton>
        )}
        <small>JPG, PNG or WEBP, up to 2 MB.</small>
      </div>
      <Form<ProfileFields>
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={saving}
        onFinish={submit}
        onValuesChange={clearError}
      >
        <Form.Item
          label="Full name"
          name="fullName"
          rules={[
            { required: true, whitespace: true, message: "Enter your full name." },
            { max: 100, message: "Use at most 100 characters." },
            {
              pattern: /^[^<>]*$/,
              message: "The name cannot contain < or >.",
            },
          ]}
        >
          <Input autoComplete="name" />
        </Form.Item>
        <Form.Item label="Email address (read only)">
          <Input value={profile?.email} disabled />
        </Form.Item>
        {profile?.organizationId && (
          <Form.Item
            label="Department (read only)"
            extra="Managed by your Organizer."
          >
            <Input value={profile.department ?? "Not set"} disabled />
          </Form.Item>
        )}
        <p className="profile-editor-note">
          Your login email cannot be changed from your profile.
        </p>
        <div className="profile-editor-actions">
          <RoleButton type="primary" htmlType="submit" loading={saving}>
            Save changes
          </RoleButton>
        </div>
      </Form>
    </div>
  );
};

export default ProfileEditor;
