import {
  Alert,
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
      message.info("No changes to save.");
      return;
    }
    if (body.timezone) {
      const confirmed = await modal.confirm({
        title: `Change timezone to ${body.timezone}?`,
        content:
          "Only deadlines set after this change use the new timezone. Deadlines and certificate dates that already exist keep their current timezone.",
        okText: "Change timezone",
        cancelText: "Cancel",
      });
      if (!confirmed) return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await updateMyOrganizationAPI(body);
      if (res.data?.id) {
        message.success("Organization updated.");
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
      setSubmitError(
        "Could not connect to the server. Please try again later.",
      );
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
        message.success("Logo updated.");
      } else {
        message.error(
          organizationErrorMessage(Number(res.statusCode), errorCodeOf(res)),
        );
      }
    } catch {
      message.error("Could not connect to the server. Please try again later.");
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
        message.success("Logo removed.");
      } else {
        message.error(
          organizationErrorMessage(Number(res.statusCode), errorCodeOf(res)),
        );
      }
    } catch {
      message.error("Could not connect to the server. Please try again later.");
    } finally {
      setLogoBusy(false);
    }
  };

  const renderBody = () => {
    if (loadFailed) {
      return (
        <Alert
          type="error"
          showIcon
          message="Could not load organization details."
          description="Please check your connection and try again."
          action={<Button onClick={() => navigate(0)}>Try again</Button>}
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
        <SectionCard title="Organization logo">
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
                <OrganizerButton icon={<UploadOutlined />} loading={logoBusy}>
                  {profile.logoUrl ? "Replace logo" : "Upload logo"}
                </OrganizerButton>
              </Upload>
              {profile.logoUrl && (
                <OrganizerButton disabled={logoBusy} onClick={removeLogo}>
                  Remove logo
                </OrganizerButton>
              )}
              <span>PNG or JPEG, at most 2 MB. Used on new certificates.</span>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Organization settings">
          {submitError && (
            <Alert type="error" showIcon message={submitError} role="alert" />
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
                label="Organization name"
                name="name"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Enter the organization name.",
                  },
                  { max: 200, message: "At most 200 characters." },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Tax code"
                name="taxCode"
                rules={[
                  { required: true, message: "Enter the tax code." },
                  {
                    pattern: /^\s*(\d\s*){10}((\d\s*){3})?$/,
                    message: "The tax code has 10 or 13 digits.",
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Address"
                name="address"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Enter the address.",
                  },
                  { max: 300, message: "At most 300 characters." },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Contact phone"
                name="contactPhone"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Enter a contact phone.",
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Contact email (optional)"
                name="contactEmail"
                rules={[
                  {
                    type: "email",
                    transform: (value: string) => value?.trim() || undefined,
                    message: "Enter a valid email address.",
                  },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Timezone"
                name="timezone"
                rules={[{ required: true, message: "Choose a timezone." }]}
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
        title="Edit Organization"
        subtitle="Update legal identity, contact, logo, and timezone."
        actions={
          <>
            <OrganizerButton onClick={() => navigate(-1)}>
              Cancel
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              htmlType="submit"
              form="organization-edit-form"
              loading={saving}
              disabled={!profile}
            >
              Save changes
            </OrganizerButton>
          </>
        }
      />
      {renderBody()}
      <WarningPanel title="Changing timezone impacts future deadlines">
        Already-computed deadlines and issued certificates keep their timezone;
        only deadlines set after the change use the new one.
      </WarningPanel>
    </OrganizerPage>
  );
};

export default OrganizationEdit;
