import {
  App,
  Button,
  Form,
  Input,
  Select,
  Skeleton,
  Upload,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import { OrganizationLogo } from "@/components/organizer/organization.logo";
import {
  getMyOrganizationAPI,
  removeOrganizationLogoAPI,
  updateMyOrganizationAPI,
  uploadOrganizationLogoAPI,
} from "@/services/organization.service";
import type {
  IApiError,
  IOrganizationProfile,
} from "@/types/organization.types";
import {
  changedFields,
  LOGO_ACCEPT,
  logoFileError,
  organizationErrorMessage,
  timezoneOptions,
  toFormValues,
  type OrganizationFormValues,
} from "@/utils/organization.profile.view";
import "./organization.edit.scss";
import { VietnameseAlert } from "@/components/vietnamese.controls";

const errorCodeOf = (res: unknown) =>
  (res as { error?: IApiError }).error?.code;

const OrganizationEdit = () => {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<OrganizationFormValues>();
  const [profile, setProfile] = useState<IOrganizationProfile | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const res = await getMyOrganizationAPI();
        if (ignore) return;
        if (res.data?.id) {
          setProfile(res.data);
          form.setFieldsValue(toFormValues(res.data));
        } else {
          setLoadFailed(true);
        }
      } catch {
        if (!ignore) setLoadFailed(true);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [form]);

  const zones = useMemo(
    () =>
      timezoneOptions(profile?.timezone ?? "Asia/Ho_Chi_Minh").map((zone) => ({
        value: zone,
        label: zone,
      })),
    [profile?.timezone],
  );

  const save = async (values: OrganizationFormValues) => {
    if (!profile) return;
    const body = changedFields(profile, values);
    if (Object.keys(body).length === 0) {
      message.info("Chưa có thay đổi nào để lưu.");
      return;
    }
    if (body.timezone) {
      const confirmed = await modal.confirm({
        title: `Đổi múi giờ sang ${body.timezone}?`,
        content:
          "Chỉ các hạn được xác định sau lần đổi này mới dùng múi giờ mới. Các hạn và ngày trên chứng chỉ đã có vẫn giữ múi giờ hiện tại.",
        okText: "Đổi múi giờ",
        cancelText: "Hủy",
      });
      if (!confirmed) return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await updateMyOrganizationAPI(body);
      if (res.data?.id) {
        message.success("Đã cập nhật thông tin tổ chức.");
        navigate("/organizer/organization");
        return;
      }
      const code = errorCodeOf(res);
      if (code === "INVALID_TIMEZONE") {
        form.setFields([
          { name: "timezone", errors: [organizationErrorMessage(400, code)] },
        ]);
      } else {
        setSubmitError(organizationErrorMessage(Number(res.statusCode), code));
      }
    } catch {
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSaving(false);
    }
  };

  const replaceLogo = async (file: File) => {
    const invalid = logoFileError(file);
    if (invalid) {
      message.error(invalid);
      return;
    }
    setLogoBusy(true);
    try {
      const res = await uploadOrganizationLogoAPI(file);
      if (res.data?.id) {
        setProfile(res.data);
        message.success("Đã cập nhật logo.");
      } else {
        message.error(
          organizationErrorMessage(Number(res.statusCode), errorCodeOf(res)),
        );
      }
    } catch {
      message.error("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      const res = await removeOrganizationLogoAPI();
      if (res.data?.id) {
        setProfile(res.data);
        message.success("Đã gỡ logo.");
      } else {
        message.error(
          organizationErrorMessage(Number(res.statusCode), errorCodeOf(res)),
        );
      }
    } catch {
      message.error("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLogoBusy(false);
    }
  };

  const renderBody = () => {
    if (loadFailed) {
      return (
        <VietnameseAlert
          type="error"
          showIcon
          message="Không tải được thông tin tổ chức."
          description="Hãy kiểm tra kết nối rồi thử lại."
          action={<Button onClick={() => navigate(0)}>Thử lại</Button>}
        />
      );
    }
    if (!profile) {
      return (
        <SectionCard>
          <Skeleton active />
        </SectionCard>
      );
    }
    return (
      <>
        <SectionCard title="Logo tổ chức">
          <div className="organizer-org-identity">
            <OrganizationLogo name={profile.name} logoUrl={profile.logoUrl} />
            <div>
              <Upload
                accept={LOGO_ACCEPT}
                showUploadList={false}
                beforeUpload={(file) => {
                  void replaceLogo(file);
                  return false;
                }}
              >
                <OrganizerButton icon={<UploadOutlined aria-hidden="true" />} loading={logoBusy}>
                  {profile.logoUrl ? "Thay logo" : "Tải logo lên"}
                </OrganizerButton>
              </Upload>
              {profile.logoUrl && (
                <OrganizerButton disabled={logoBusy} onClick={removeLogo}>
                  Gỡ logo
                </OrganizerButton>
              )}
              <span>
                PNG hoặc JPEG, tối đa 2 MB. Dùng trên các chứng chỉ cấp mới.
              </span>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Thông tin tổ chức">
          {submitError && (
            <VietnameseAlert type="error" showIcon message={submitError} role="alert" />
          )}
          <Form<OrganizationFormValues>
            id="organization-edit-form"
            form={form}
            className="organizer-form"
            layout="vertical"
            requiredMark={false}
            disabled={saving}
            onFinish={save}
          >
            <div className="organizer-form-grid">
              <Form.Item
                label="Tên tổ chức"
                name="name"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Hãy nhập tên tổ chức.",
                  },
                  { max: 200, message: "Tối đa 200 ký tự." },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Mã số thuế"
                name="taxCode"
                rules={[
                  { required: true, message: "Hãy nhập mã số thuế." },
                  {
                    pattern: /^\s*(\d\s*){10}((\d\s*){3})?$/,
                    message: "Mã số thuế gồm 10 hoặc 13 chữ số.",
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Địa chỉ"
                name="address"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Hãy nhập địa chỉ.",
                  },
                  { max: 300, message: "Tối đa 300 ký tự." },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Số điện thoại liên hệ"
                name="contactPhone"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Hãy nhập số điện thoại liên hệ.",
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Email liên hệ (không bắt buộc)"
                name="contactEmail"
                rules={[
                  {
                    type: "email",
                    transform: (value: string) => value?.trim() || undefined,
                    message: "Địa chỉ email không hợp lệ.",
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Múi giờ"
                name="timezone"
                rules={[{ required: true, message: "Hãy chọn múi giờ." }]}
              >
                <Select showSearch options={zones} />
              </Form.Item>
            </div>
          </Form>
        </SectionCard>
      </>
    );
  };

  return (
    <OrganizerPage className="organizer-organization-edit">
      <PageHeader
        title="Sửa thông tin tổ chức"
        subtitle="Cập nhật thông tin định danh, liên hệ, logo và múi giờ."
        actions={
          <>
            <OrganizerButton onClick={() => navigate(-1)}>Hủy</OrganizerButton>
            <OrganizerButton
              type="primary"
              htmlType="submit"
              form="organization-edit-form"
              loading={saving}
              disabled={!profile}
            >
              Lưu thay đổi
            </OrganizerButton>
          </>
        }
      />
      {renderBody()}
      <WarningPanel title="Đổi múi giờ ảnh hưởng tới các hạn sau này">
        Các hạn đã xác định và chứng chỉ đã cấp giữ nguyên múi giờ; chỉ các hạn
        được xác định sau lần đổi mới dùng múi giờ mới.
      </WarningPanel>
    </OrganizerPage>
  );
};

export default OrganizationEdit;
