import { useEffect, useRef, type ComponentType } from "react";
import { Avatar, Form, Input, Spin, message, type ButtonProps } from "antd";
import { initialsOf, useMyProfile } from "@/hooks/use.my.profile";
import "./profile.editor.scss";
import { VietnameseAlert } from "@/components/vietnamese.controls";

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
    if (file && (await uploadAvatar(file))) message.success("Đã cập nhật ảnh đại diện.");
  }

  async function submit(values: ProfileFields) {
    if (await saveName(values.fullName)) {
      message.success("Đã cập nhật hồ sơ.");
      onSaved();
    }
  }

  if (loading) return <Spin />;

  return (
    <div className="profile-editor">
      {error && (
        <VietnameseAlert
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
          Đổi ảnh
        </RoleButton>
        {profile?.avatarUrl && (
          <RoleButton
            danger
            disabled={uploading}
            onClick={async () => {
              if (await removeAvatar()) message.success("Đã gỡ ảnh đại diện.");
            }}
          >
            Gỡ ảnh
          </RoleButton>
        )}
        <small>JPG, PNG hoặc WEBP, tối đa 2 MB.</small>
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
          label="Họ và tên"
          name="fullName"
          rules={[
            { required: true, whitespace: true, message: "Hãy nhập họ và tên." },
            { max: 100, message: "Tối đa 100 ký tự." },
            {
              pattern: /^[^<>]*$/,
              message: "Họ và tên không được chứa < hoặc >.",
            },
          ]}
        >
          <Input autoComplete="name" />
        </Form.Item>
        <Form.Item label="Địa chỉ email (chỉ xem)">
          <Input value={profile?.email} disabled />
        </Form.Item>
        {profile?.organizationId && (
          <Form.Item
            label="Đơn vị công tác (chỉ xem)"
            extra="Do quản lý đào tạo quản lý."
          >
            <Input value={profile.department ?? "Chưa có"} disabled />
          </Form.Item>
        )}
        <p className="profile-editor-note">
          Bạn không tự đổi được email đăng nhập trong hồ sơ.
        </p>
        <div className="profile-editor-actions">
          <RoleButton type="primary" htmlType="submit" loading={saving}>
            Lưu thay đổi
          </RoleButton>
        </div>
      </Form>
    </div>
  );
};

export default ProfileEditor;
