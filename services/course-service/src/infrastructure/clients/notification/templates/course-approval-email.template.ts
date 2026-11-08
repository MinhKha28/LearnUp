interface CourseApprovalEmailData {
  courseName: string;
  versionNumber: number;
  reviewUrl?: string;
}

// Tránh tên Course chứa HTML làm ảnh hưởng nội dung email.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildCourseApprovalEmail(
  data: CourseApprovalEmailData,
): string {
  const courseName = escapeHtml(data.courseName);

  // Chỉ chấp nhận URL HTTPS hoặc HTTP khi chạy localhost.
  let reviewUrl: string | undefined;

  if (data.reviewUrl) {
    try {
      const url = new URL(data.reviewUrl);

      if (
        url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname))
      ) {
        reviewUrl = escapeHtml(url.toString());
      }
    } catch {
      // URL không hợp lệ thì không hiển thị nút.
    }
  }

  const reviewButton = reviewUrl
    ? `
      <table
        role="presentation"
        cellpadding="0"
        cellspacing="0"
        border="0"
        align="center"
        style="margin:28px auto;"
      >
        <tr>
          <td
            align="center"
            bgcolor="#2563eb"
            style="background-color:#2563eb;border-radius:8px;"
          >
            <a
              href="${reviewUrl}"
              target="_blank"
              style="display:inline-block;padding:14px 28px;
                font-family:Arial,Helvetica,sans-serif;
                font-size:15px;font-weight:700;
                line-height:20px;color:#ffffff;
                text-decoration:none;border-radius:8px;"
            >
              Review Course
            </a>
          </td>
        </tr>
      </table>
    `
    : `
      <p
        style="margin:26px 0;text-align:center;
          font-family:Arial,Helvetica,sans-serif;
          font-size:14px;line-height:22px;color:#64748b;"
      >
        Please sign in to LearnUP to review this Course.
      </p>
    `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>Course Awaiting Approval</title>
</head>

<body
  style="margin:0;padding:0;width:100%;
    background-color:#f1f5f9;"
>
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="width:100%;background-color:#f1f5f9;
      border-collapse:collapse;"
  >
    <tr>
      <td
        align="center"
        style="padding:36px 16px;"
      >
        <table
          role="presentation"
          width="600"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="width:100%;max-width:600px;
            background-color:#ffffff;
            border-collapse:collapse;"
        >
          <!-- Header -->
          <tr>
            <td
              align="center"
              bgcolor="#172554"
              style="padding:32px 24px;
                background-color:#172554;"
            >
              <div
                style="font-family:Arial,Helvetica,sans-serif;
                  font-size:30px;font-weight:700;
                  line-height:38px;color:#ffffff;"
              >
                Learn<span style="color:#93c5fd;">UP</span>
              </div>

              <p
                style="margin:8px 0 0;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:12px;line-height:18px;
                  letter-spacing:1px;color:#cbd5e1;"
              >
                CORPORATE LEARNING PLATFORM
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding:36px 32px;">

              <h1
                style="margin:0 0 16px;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:25px;line-height:34px;
                  font-weight:700;color:#0f172a;
                  text-align:center;"
              >
                Course Awaiting Approval
              </h1>

              <p
                style="margin:0 0 28px;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:15px;line-height:25px;
                  color:#475569;text-align:center;"
              >
                An Instructor has submitted a Course
                for your review and approval.
              </p>

              <!-- Course details -->
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                bgcolor="#f8fafc"
                style="width:100%;
                  background-color:#f8fafc;
                  border-collapse:collapse;"
              >
                <tr>
                  <td style="padding:22px 24px;">

                    <p
                      style="margin:0 0 14px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:11px;line-height:18px;
                        font-weight:700;letter-spacing:1px;
                        color:#64748b;"
                    >
                      COURSE DETAILS
                    </p>

                    <p
                      style="margin:0 0 18px;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:18px;line-height:27px;
                        font-weight:700;color:#0f172a;
                        overflow-wrap:break-word;"
                    >
                      ${courseName}
                    </p>

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="border-collapse:collapse;"
                    >
                      <tr>
                        <td
                          style="padding:9px 0;
                            font-family:Arial,Helvetica,sans-serif;
                            font-size:14px;color:#64748b;"
                        >
                          Version
                        </td>
                        <td
                          align="right"
                          style="padding:9px 0;
                            font-family:Arial,Helvetica,sans-serif;
                            font-size:14px;font-weight:700;
                            color:#0f172a;"
                        >
                          ${data.versionNumber}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="padding:12px 0 0;
                            border-top:1px solid #e2e8f0;
                            font-family:Arial,Helvetica,sans-serif;
                            font-size:14px;color:#64748b;"
                        >
                          Status
                        </td>
                        <td
                          align="right"
                          style="padding:12px 0 0;
                            border-top:1px solid #e2e8f0;
                            font-family:Arial,Helvetica,sans-serif;
                            font-size:13px;font-weight:700;
                            color:#b45309;"
                        >
                          Awaiting Approval
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- CTA -->
              ${reviewButton}

              <p
                style="margin:0;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:13px;line-height:21px;
                  color:#64748b;text-align:center;"
              >
                This Course is awaiting your decision
                and has not been published yet.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td
              align="center"
              bgcolor="#f8fafc"
              style="padding:22px 24px;
                border-top:1px solid #e2e8f0;
                background-color:#f8fafc;"
            >
              <p
                style="margin:0 0 6px;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:12px;line-height:19px;
                  color:#64748b;"
              >
                LearnUP - Corporate Learning Platform
              </p>

              <p
                style="margin:0;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:11px;line-height:18px;
                  color:#94a3b8;"
              >
                This is an automated notification.
                Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
