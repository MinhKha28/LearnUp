// Màu khớp frontend (styles/global.scss): xanh đậm thương hiệu + cam nhấn.
const COLORS = {
  primary: '#0f172a',
  accent: '#f59e0b',
  accentSoft: '#fff7ed',
  text: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  page: '#f1f5f9',
};

/** Dữ liệu người dùng nhập (tên, tên tổ chức) phải escape trước khi ghép vào HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Ngày giờ hiển thị theo giờ Việt Nam, ví dụ "13:05 06/10/2026". */
export function formatDateTimeVi(date: Date): string {
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Đoạn văn; nội dung đã escape sẵn hoặc chỉ chứa thẻ do template tự tạo. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${COLORS.text}">${html}</p>`;
}

/** Nút bấm dạng bảng để hiển thị đúng trên cả Gmail lẫn Outlook. */
export function button(label: string, url: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">` +
    `<tr><td style="border-radius:8px;background:${COLORS.accent}">` +
    `<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 28px;font-size:15px;` +
    `font-weight:700;color:${COLORS.primary};text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>` +
    `</td></tr></table>`
  );
}

/** Ô hiển thị mã xác thực 6 số, chữ lớn, giãn cách để dễ đọc và dễ gõ lại. */
export function codeBox(code: string): string {
  return (
    `<div style="margin:20px 0;padding:18px;text-align:center;background:${COLORS.accentSoft};` +
    `border:1px dashed ${COLORS.accent};border-radius:10px;font-family:'Courier New',monospace;` +
    `font-size:34px;font-weight:700;letter-spacing:10px;color:${COLORS.primary}">${escapeHtml(code)}</div>`
  );
}

/** Khung thư: header thương hiệu, tiêu đề, nội dung, footer. */
export function renderLayout(params: {
  preheader: string;
  heading: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(params.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(params.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden">
<tr><td style="background:${COLORS.primary};padding:20px 32px;font-size:22px;font-weight:800;color:#ffffff">Learn<span style="color:${COLORS.accent}">UP</span></td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${COLORS.primary}">${escapeHtml(params.heading)}</h1>
${params.bodyHtml}
</td></tr>
<tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid ${COLORS.border};font-size:12px;line-height:1.6;color:${COLORS.muted}">
Email này được gửi tự động từ LearnUP, vui lòng không trả lời. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
