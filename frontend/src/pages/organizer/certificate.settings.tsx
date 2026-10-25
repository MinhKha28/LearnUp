import { Alert, App, Button, Form, Input, Modal, Skeleton, Space, Spin, Upload } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { OrganizerButton, OrganizerPage, PageHeader, SectionCard } from "@/components/organizer/organizer.ui";
import { getSettings, getSignatureBlob, updateSettings } from "@/services/certificate-signer.service";
import { getCurrentSubscriptionAPI } from "@/services/subscription.service";
import { ApiError } from "@/types/api.types";
import type { ISubscriptionOverview } from "@/types/subscription.types";
import type { SignerDraft, SignerSettings } from "@/types/certificate-signer.types";
import { draftFromSettings, signerDirty, signerTextError, validateSignature } from "@/utils/certificate.signer";
import "./certificate.settings.scss";

type Baseline = { settings: SignerSettings; etag: string | null };
type ReloadMode = "normal" | "conflict" | "uncertain" | "required" | "saved";

function failureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "TENANT_UNAVAILABLE") return "Chưa kiểm tra được quyền ghi của tổ chức. Vui lòng thử lại.";
    if (error.code === "STORAGE_UNAVAILABLE") return "Kho lưu trữ ảnh tạm thời không khả dụng. Vui lòng thử lại.";
    if (error.status === 0) return "Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.";
  }
  return "Không tải được cấu hình. Vui lòng thử lại.";
}

function useSavedSignature(baseline: Baseline | null) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const version = baseline?.settings.version;
  const etag = baseline?.etag;
  const hasSignature = !!baseline?.settings.signature;
  useEffect(() => {
    const controller = new AbortController();
    let ownedUrl: string | undefined;
    setUrl(undefined);
    setError(undefined);
    setLoading(hasSignature);
    if (hasSignature) {
      void getSignatureBlob(controller.signal).then(blob => {
        if (controller.signal.aborted) return;
        ownedUrl = URL.createObjectURL(blob);
        setUrl(ownedUrl);
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setError(error instanceof ApiError && error.code === "SIGNATURE_NOT_FOUND"
          ? "Không tìm thấy ảnh dù cấu hình vẫn ghi nhận có ảnh. Vui lòng thử tải lại."
          : failureMessage(error));
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }
    return () => {
      controller.abort();
      if (ownedUrl) URL.revokeObjectURL(ownedUrl);
    };
  }, [version, etag, hasSignature, retry]);
  return { url, error, loading, retry: () => setRetry(value => value + 1) };
}

const CertificateSettings = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ name: string; title: string }>();
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [draft, setDraft] = useState<SignerDraft>({ name: "", title: "", signatureAction: "keep" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [reloadError, setReloadError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [requiredReload, setRequiredReload] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [draftUrl, setDraftUrl] = useState<string>();
  const active = useRef(true);
  const busy = useRef(false);
  const requestId = useRef(0);
  const fileId = useRef(0);
  const retryMode = useRef<ReloadMode>("normal");
  const snapshot = useRef({ baseline, draft, saving, validating, conflict, requiredReload });
  snapshot.current = { baseline, draft, saving, validating, conflict, requiredReload };
  const image = useSavedSignature(baseline);
  const dirty = !!baseline && signerDirty(draft, baseline.settings);
  const blocker = useBlocker(dirty || saving || validating || conflict);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (!draft.file) { setDraftUrl(undefined); return; }
    const url = URL.createObjectURL(draft.file);
    setDraftUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.file]);

  const load = useCallback(async (mode: ReloadMode = "normal", committed?: Baseline) => {
    const id = ++requestId.current;
    retryMode.current = mode;
    setRefreshing(true);
    setReloadError(undefined);
    try {
      const latest = await getSettings();
      if (!active.current || id !== requestId.current) return;
      const current = snapshot.current;
      const changed = !!current.baseline && (current.baseline.etag !== latest.etag ||
        current.baseline.settings.version !== latest.settings.version);
      const preserve = !(mode === "saved" && current.saving) && (
        mode !== "normal" && mode !== "saved" || current.saving || current.validating || current.conflict ||
        !!current.baseline && signerDirty(current.draft, current.baseline.settings));
      setBaseline(latest);
      if (!preserve) {
        const next = draftFromSettings(latest.settings);
        setDraft(next);
        form.setFieldsValue(next);
      }
      if (mode === "conflict" || changed && preserve) setConflict(true);
      if (mode === "uncertain") {
        setUncertain(false);
        if (changed) setConflict(true);
      }
      setRequiredReload(false);
      setLoadError(undefined);
    } catch (error) {
      if (!active.current || id !== requestId.current) return;
      if (error instanceof ApiError && error.code === "FORBIDDEN_ROLE") setForbidden(true);
      if (committed) setBaseline(committed);
      if (snapshot.current.baseline || committed) setReloadError(failureMessage(error));
      else setLoadError(failureMessage(error));
    } finally {
      if (active.current && id === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [form]);

  useEffect(() => {
    void load();
    void getCurrentSubscriptionAPI().then(response => {
      const overview = (response as unknown as { data?: ISubscriptionOverview }).data;
      if (active.current && overview?.subscription?.status === "Suspended") setReadOnly(true);
    }).catch(() => undefined);
    const refresh = () => {
      const current = snapshot.current;
      if (document.visibilityState === "hidden" || busy.current || current.saving || current.validating ||
        current.conflict || current.requiredReload || current.baseline && signerDirty(current.draft, current.baseline.settings)) return;
      busy.current = true;
      void load().finally(() => { busy.current = false; });
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty || saving || validating || conflict) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty, saving, validating, conflict]);

  function useLatest() {
    if (!baseline || saving || refreshing) return;
    fileId.current++;
    const next = draftFromSettings(baseline.settings);
    form.resetFields();
    form.setFieldsValue(next);
    setDraft(next);
    setUploadError(undefined);
    setSubmitError(undefined);
    setConflict(false);
    setUncertain(false);
  }

  async function selectFile(file: File) {
    const id = ++fileId.current;
    setValidating(true);
    setUploadError(undefined);
    try {
      await validateSignature(file);
      if (active.current && id === fileId.current)
        setDraft(value => ({ ...value, signatureAction: "replace", file }));
    } catch (error) {
      if (active.current && id === fileId.current)
        setUploadError(error instanceof Error ? error.message : "Không đọc được ảnh.");
    } finally {
      if (active.current && id === fileId.current) setValidating(false);
    }
    return Upload.LIST_IGNORE;
  }

  async function save() {
    if (!baseline || busy.current || saving || validating || readOnly || forbidden || refreshing || reloadError && !uncertain) return;
    if (!baseline.etag || requiredReload) { setRequiredReload(true); return; }
    busy.current = true;
    setSaving(true);
    setUncertain(false);
    setReloadError(undefined);
    setSubmitError(undefined);
    setUploadError(undefined);
    try {
      const result = await updateSettings(draft, baseline.etag);
      if (!active.current) return;
      const next = draftFromSettings(result.settings);
      setDraft(next);
      form.setFieldsValue(next);
      setConflict(false);
      setUncertain(false);
      setRequiredReload(!result.etag);
      await load("saved", result);
      if (active.current) void message.success("Đã lưu cấu hình người ký Certificate.");
    } catch (error) {
      if (!active.current) return;
      if (!(error instanceof ApiError)) { setSubmitError(failureMessage(error)); return; }
      if (error.status === 412) {
        setConflict(true);
        await load("conflict");
      } else if (error.status === 428) {
        setRequiredReload(true);
      } else if (error.code === "ORGANIZATION_READ_ONLY") {
        setReadOnly(true);
      } else if (error.code === "FORBIDDEN_ROLE") {
        setForbidden(true);
      } else if (error.code === "SIGNER_NAME_INVALID") {
        const fields = [
          { name: "name" as const, errors: [signerTextError(draft.name, 100)].filter((v): v is string => !!v) },
          { name: "title" as const, errors: [signerTextError(draft.title, 200)].filter((v): v is string => !!v) },
        ];
        form.setFields(fields);
        if (!fields.some(field => field.errors.length)) setSubmitError("Tên hoặc chức danh không hợp lệ. Vui lòng kiểm tra lại.");
      } else if ([413, 415].includes(error.status) || error.code.startsWith("SIGNATURE_")) {
        setUploadError(error.status === 413 ? "Ảnh không được vượt quá 2 MiB (2.097.152 byte)." :
          error.status === 415 ? "Chỉ chấp nhận ảnh PNG hoặc JPEG." : "Ảnh không hợp lệ. Vui lòng kiểm tra hoặc chọn lại ảnh.");
      } else if (error.status === 0) {
        setUncertain(true);
        setReloadError(undefined);
      } else if (error.status === 400) {
        setSubmitError("Thông tin gửi lên không hợp lệ. Vui lòng kiểm tra tên, chức danh và ảnh.");
      } else {
        setSubmitError(failureMessage(error));
      }
    } finally {
      busy.current = false;
      if (active.current) setSaving(false);
    }
  }

  const locked = loading || saving || validating || readOnly || forbidden;
  const renderSavedImage = () => image.loading ? <Spin size="small" /> :
    image.error ? <Alert type="error" showIcon message={image.error} action={<Button onClick={image.retry}>Thử tải lại ảnh</Button>} /> :
      image.url ? <img className="certificate-settings-image" src={image.url} alt="Chữ ký đã lưu trên hệ thống" /> :
        baseline?.settings.signature ? <Spin size="small" /> : <p>Chưa có ảnh chữ ký.</p>;

  return (
    <OrganizerPage className="certificate-settings">
      <PageHeader title="Cấu hình người ký Certificate" subtitle="Quản lý tên, chức danh và ảnh chữ ký dùng cho Certificate cấp sau này."
        actions={<>
          <OrganizerButton disabled={loading || saving || validating || refreshing || !baseline} onClick={useLatest}>Hủy thay đổi</OrganizerButton>
          <OrganizerButton type="primary" htmlType="submit" form="certificate-signer-form" loading={saving}
            disabled={locked || refreshing || !baseline || !dirty || !baseline.etag || requiredReload || !!reloadError && !uncertain}>Lưu</OrganizerButton>
        </>} />
      <Alert type="info" showIcon message="Lưu ý về Certificate" description={<ul>
        <li>Thay đổi chỉ áp dụng cho Certificate cấp sau này; Certificate đã cấp giữ nguyên.</li>
        <li>Chưa cấu hình người ký vẫn cấp Certificate (không có chữ ký).</li>
        <li>Nên dùng ảnh PNG nền trong suốt, ví dụ 450 × 150 px. Chấp nhận PNG hoặc JPEG, tối đa 2 MiB.</li>
      </ul>} />
      {readOnly && <Alert type="warning" showIcon message="Tổ chức đang ở chế độ chỉ đọc. Thay đổi của bạn được giữ lại, nhưng chưa thể lưu." />}
      {forbidden && <Alert type="error" showIcon message="Bạn không có quyền cấu hình người ký Certificate." />}
      {(requiredReload || baseline && !baseline.etag) && <Alert type="warning" showIcon
        message="Cần tải lại cấu hình trước khi lưu." description={reloadError} action={<Button disabled={refreshing || saving} onClick={() => void load("required")}>Tải lại cấu hình</Button>} />}
      {reloadError && !uncertain && !conflict && !requiredReload && <Alert type="error" showIcon message={reloadError}
        action={<Button loading={refreshing} onClick={() => void load(retryMode.current)}>Thử tải lại cấu hình</Button>} />}
      {uncertain && <Alert type="warning" showIcon
        message="Mất kết nối khi lưu, chưa rõ thay đổi đã được lưu hay chưa. Bản nháp vẫn được giữ. Bạn có thể tải lại cấu hình để đối chiếu, hoặc bấm Lưu lại – nếu lần trước đã lưu, hệ thống sẽ báo để bạn chọn."
        description={refreshing ? "Đang tải lại cấu hình…" : reloadError ? "Chưa tải lại được cấu hình. Bạn vẫn có thể thử tải lại hoặc bấm Lưu." : undefined}
        action={<Button loading={refreshing} disabled={saving} onClick={() => void load("uncertain")}>Tải lại cấu hình</Button>} />}
      {loading ? <SectionCard><Skeleton active /></SectionCard> : loadError ? <Alert type="error" showIcon message={loadError}
        action={<Button onClick={() => void load()}>Thử lại</Button>} /> : baseline && <>
        {conflict && !uncertain && <SectionCard title="Cấu hình vừa được lưu ở nơi khác – thay đổi của bạn chưa được lưu">
          {refreshing ? <p><Spin size="small" /> Đang tải cấu hình mới để đối chiếu…</p> : reloadError
            ? <><p>{reloadError} Chưa tải được bản mới. Vui lòng thử tải lại cấu hình trước khi lưu.</p><Button onClick={() => void load("conflict")}>Thử tải lại cấu hình</Button></>
            : <><p>Bản đang lưu trên hệ thống – Tên: {baseline.settings.signerName || "Chưa cấu hình"} · Chức danh: {baseline.settings.signerTitle || "Chưa có chức danh"}</p>
              {draft.signatureAction !== "keep" && renderSavedImage()}</>}
          <p>Bản nháp bên dưới vẫn được giữ. Bạn có thể sửa tiếp và bấm Lưu.</p>
          {draft.signatureAction === "keep" && !refreshing && !reloadError && <p>Sẽ giữ ảnh hiện tại trên hệ thống.</p>}
          <Button disabled={saving || refreshing || !!reloadError} onClick={useLatest}>Dùng bản mới</Button>
        </SectionCard>}
        <SectionCard title={baseline.settings.configured ? "Thông tin người ký" : "Chưa cấu hình người ký"}>
          <Form name="certificate-signer-form" id="certificate-signer-form" form={form} layout="vertical" className="organizer-form"
            disabled={locked} onFinish={() => void save()} onValuesChange={(_, values: { name: string; title: string }) =>
              setDraft(value => ({ ...value, ...values }))}>
            {submitError && <Alert type="error" showIcon message={submitError} />}
            <div className="organizer-form-grid">
              <Form.Item name="name" label="Tên người ký" rules={[{ validator: (_, value: string = "") => {
                const error = signerTextError(value, 100); return error ? Promise.reject(new Error(error)) : Promise.resolve();
              } }]}><Input autoComplete="off" /></Form.Item>
              <Form.Item name="title" label="Chức danh" rules={[{ validator: (_, value: string = "") => {
                const error = signerTextError(value, 200); return error ? Promise.reject(new Error(error)) : Promise.resolve();
              } }]}><Input autoComplete="off" /></Form.Item>
            </div>
            <Form.Item label="Ảnh chữ ký" validateStatus={uploadError ? "error" : undefined} help={uploadError}>
              <div className="certificate-settings-preview" aria-live="polite">
                {draft.signatureAction === "replace" && draftUrl
                  ? <><img className="certificate-settings-image" src={draftUrl} alt="Ảnh chữ ký mới chưa lưu" /><p>Ảnh mới – chưa lưu.</p></>
                  : draft.signatureAction === "remove" ? <p>Ảnh chữ ký sẽ được xóa khi bấm Lưu.</p> : renderSavedImage()}
              </div>
              <Space wrap>
                <Upload accept="image/png,image/jpeg" maxCount={1} showUploadList={false} beforeUpload={selectFile} disabled={locked}>
                  <OrganizerButton icon={<UploadOutlined />} disabled={locked} loading={validating}>Chọn ảnh</OrganizerButton>
                </Upload>
                <OrganizerButton icon={<DeleteOutlined />} disabled={locked || draft.signatureAction === "remove" ||
                  !draft.file && !baseline.settings.signature} onClick={() => {
                    fileId.current++;
                    setDraft(value => ({ ...value, signatureAction: "remove", file: undefined }));
                    setUploadError(undefined);
                  }}>Xóa ảnh</OrganizerButton>
              </Space>
            </Form.Item>
          </Form>
        </SectionCard>
      </>}
      <Modal open={blocker.state === "blocked"} title="Rời trang khi chưa lưu?"
        okText="Rời trang" cancelText="Ở lại" okButtonProps={{ danger: true }} cancelButtonProps={{ autoFocus: true, id: "certificate-settings-stay" }}
        afterOpenChange={open => { if (open) document.getElementById("certificate-settings-stay")?.focus(); }} onOk={() => blocker.state === "blocked" && blocker.proceed()}
        onCancel={() => blocker.state === "blocked" && blocker.reset()}>
        <p>{saving ? "Yêu cầu lưu đang được xử lý. Rời trang không hủy thao tác trên máy chủ." : "Thay đổi chưa lưu sẽ bị mất nếu bạn rời trang."}</p>
      </Modal>
    </OrganizerPage>
  );
};

export default CertificateSettings;
