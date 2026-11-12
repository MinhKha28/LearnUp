import { Alert, AutoComplete, Button, DatePicker, Form, Input, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { fetchAuditLogsAPI } from "@/services/audit.service";
import { formatDateTimeVN } from "@/utils/helper";
import type { IAuditLog, IAuditLogPage } from "@/types/audit.types";
import {
  AUDIT_PAGE_SIZE,
  AUDIT_TARGET_ID_MAX_LENGTH,
  TARGET_TYPE_OPTIONS,
  actionLabel,
  actorRoleLabel,
  isKnownAction,
  isKnownTargetType,
  hasAuditFilter,
  parseAuditDetails,
  rangeIsReversed,
  readAuditFilter,
  shortId,
  targetTypeLabel,
} from "@/utils/audit.log";
import "./audit.log.view.scss";

interface Props {
  /** UC51: the Admin also sees which Organization an action belongs to. */
  showOrganization?: boolean;
}

const MESSAGES: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền xem nhật ký.",
};
/** The days of the filter travel as yyyy-MM-dd in the URL and show as dd/MM/yyyy in the field. */
const DAY_FORMAT = "YYYY-MM-DD";
const GENERIC_ERROR = "Không tải được nhật ký. Vui lòng thử lại.";

/** The answer of an HTTP error arrives as the body, not as an exception (see the axios interceptor). */
const errorMessageOf = (response: { error?: unknown }) => {
  const error = response.error;
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  return MESSAGES[code] ?? GENERIC_ERROR;
};

const parsePage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

/**
 * UC50 and UC51: the list of the recorded actions, filtered by the target and by a time range. The filter and the page live in the
 * URL so a reload or the back button keeps them. No export and no before/after comparison in the MVP (BR-338).
 */
const AuditLogView = ({ showOrganization = false }: Props) => {
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const filter = readAuditFilter(params);
  const reversed = rangeIsReversed(filter);
  const { targetResourceType, targetResourceId, from, to } = filter;

  const [draft, setDraft] = useState({
    type: targetResourceType ?? "",
    target: targetResourceId ?? "",
    from: from ?? "",
    to: to ?? "",
  });
  const [formError, setFormError] = useState("");
  const [data, setData] = useState<IAuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // The back button changes the URL without touching the form: bring the form back in line.
  useEffect(() => {
    setDraft({ type: targetResourceType ?? "", target: targetResourceId ?? "", from: from ?? "", to: to ?? "" });
  }, [targetResourceType, targetResourceId, from, to]);

  useEffect(() => {
    if (reversed) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const run = async () => {
      try {
        const response = await fetchAuditLogsAPI({ page, targetResourceType, targetResourceId, from, to }, controller.signal);
        if (controller.signal.aborted) return;
        if (response.data) setData(response.data);
        else setError(errorMessageOf(response));
      } catch {
        if (!controller.signal.aborted) setError(GENERIC_ERROR);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [page, targetResourceType, targetResourceId, from, to, reversed, reloadKey]);

  // A page past the end (the entries were fewer than when the link was made): go to the last one.
  useEffect(() => {
    if (!data || loading) return;
    const { items, totalPages } = data;
    if (items.length === 0 && page > 1 && totalPages > 0) {
      const next = new URLSearchParams(params);
      next.set("page", String(totalPages));
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    const type = draft.type.trim();
    const target = draft.target.trim();
    if (draft.from && draft.to && draft.from > draft.to) {
      setFormError("Ngày bắt đầu phải trước hoặc cùng ngày với ngày kết thúc.");
      return;
    }
    setFormError("");
    if (type) next.set("type", type);
    if (target) next.set("target", target);
    if (draft.from) next.set("from", draft.from);
    if (draft.to) next.set("to", draft.to);
    setParams(next);
  };

  const clear = () => {
    setFormError("");
    setDraft({ type: "", target: "", from: "", to: "" });
    setParams(new URLSearchParams());
  };

  const columns: ColumnsType<IAuditLog> = [
    { title: "Thời điểm", key: "time", width: 150, render: (_, log) => formatDateTimeVN(log.createdAt) },
    {
      title: "Người thực hiện",
      key: "actor",
      render: (_, log) => (
        <span title={log.actorUserId ?? undefined}>
          {actorRoleLabel(log.actorRole)}
          {log.actorUserId ? <span className="audit-log-id"> ({shortId(log.actorUserId)})</span> : null}
        </span>
      ),
    },
    {
      title: "Hành động",
      key: "action",
      render: (_, log) => (
        <>
          {actionLabel(log.actionType)}
          {isKnownAction(log.actionType) ? null : <span className="audit-log-id"> ({log.actionType})</span>}
        </>
      ),
    },
    {
      title: "Đối tượng tác động",
      key: "target",
      render: (_, log) => (
        <span title={log.targetResourceId ?? undefined}>
          {targetTypeLabel(log.targetResourceType)}
          {log.targetResourceType && !isKnownTargetType(log.targetResourceType) ? (
            <span className="audit-log-id"> ({log.targetResourceType})</span>
          ) : null}
          {log.targetResourceId ? <span className="audit-log-id"> ({shortId(log.targetResourceId)})</span> : null}
        </span>
      ),
    },
    ...(showOrganization
      ? [
          {
            title: "Tổ chức",
            key: "organization",
            render: (_: unknown, log: IAuditLog) =>
              log.organizationId ? <span title={log.organizationId}>{shortId(log.organizationId)}</span> : "Cấp nền tảng",
          },
        ]
      : []),
    { title: "Lý do", key: "reason", render: (_, log) => parseAuditDetails(log.details).reason ?? "—" },
  ];

  const filtered = hasAuditFilter(filter);

  return (
    <div className="audit-log-view">
      <form className="audit-log-filters" onSubmit={apply} aria-label="Bộ lọc nhật ký">
        <Form.Item
          className="audit-log-target-type"
          label="Loại đối tượng"
          htmlFor="audit-target-type"
          extra={<span id="audit-target-type-help">Chọn gợi ý hoặc nhập mã. User là tài khoản người dùng.</span>}
        >
          <AutoComplete
            id="audit-target-type"
            aria-describedby="audit-target-type-help"
            allowClear
            options={TARGET_TYPE_OPTIONS}
            value={draft.type}
            onChange={(value) => setDraft((current) => ({ ...current, type: value ?? "" }))}
            placeholder="Ví dụ: User"
          />
        </Form.Item>
        <label>
          <span>Mã đối tượng</span>
          <Input
            aria-label="Mã đối tượng"
            allowClear
            maxLength={AUDIT_TARGET_ID_MAX_LENGTH}
            value={draft.target}
            onChange={(event) => setDraft((current) => ({ ...current, target: event.target.value }))}
          />
        </label>
        <label htmlFor="audit-from">
          <span>Từ ngày</span>
          <DatePicker
            id="audit-from"
            allowClear
            format="DD/MM/YYYY"
            placeholder="dd/mm/yyyy"
            style={{ width: "100%" }}
            value={draft.from ? dayjs(draft.from, DAY_FORMAT, true) : null}
            onChange={(day) => setDraft((current) => ({ ...current, from: day ? day.format(DAY_FORMAT) : "" }))}
          />
        </label>
        <label htmlFor="audit-to">
          <span>Đến ngày</span>
          <DatePicker
            id="audit-to"
            allowClear
            format="DD/MM/YYYY"
            placeholder="dd/mm/yyyy"
            style={{ width: "100%" }}
            value={draft.to ? dayjs(draft.to, DAY_FORMAT, true) : null}
            onChange={(day) => setDraft((current) => ({ ...current, to: day ? day.format(DAY_FORMAT) : "" }))}
          />
        </label>
        <div className="audit-log-filter-actions">
          <Button type="primary" htmlType="submit">
            Lọc
          </Button>
          <Button onClick={clear} disabled={!filtered && !draft.type && !draft.target && !draft.from && !draft.to}>
            Xóa bộ lọc
          </Button>
        </div>
      </form>

      {(formError || reversed) && (
        <Alert
          className="audit-log-alert"
          type="warning"
          showIcon
          message={formError || "Ngày bắt đầu phải trước hoặc cùng ngày với ngày kết thúc."}
        />
      )}

      {error && !reversed ? (
        <Alert
          className="audit-log-alert"
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" onClick={() => setReloadKey((key) => key + 1)}>
              Thử lại
            </Button>
          }
        />
      ) : (
        !reversed && (
          <Table<IAuditLog>
            rowKey="id"
            columns={columns}
            dataSource={data?.items ?? []}
            loading={loading}
            scroll={{ x: "max-content" }}
            locale={{ emptyText: filtered ? "Không có bản ghi nào phù hợp với bộ lọc." : "Chưa có hành động nào được ghi nhận." }}
            pagination={{
              current: page,
              pageSize: AUDIT_PAGE_SIZE,
              total: data?.totalElements ?? 0,
              showSizeChanger: false,
              hideOnSinglePage: true,
              onChange: (next) => {
                const query = new URLSearchParams(params);
                query.set("page", String(next));
                setParams(query);
              },
            }}
          />
        )
      )}
    </div>
  );
};

export default AuditLogView;
