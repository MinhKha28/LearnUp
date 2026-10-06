import { IRenderedEmail } from './interfaces/rendered-email.interface';
import {
  IOrganizerActivatedEmailParams,
  IReopenLinkEmailParams,
  IVerificationEmailParams,
} from './interfaces/registration-email-params.interface';
import {
  button,
  codeBox,
  escapeHtml,
  formatDateTimeVi,
  paragraph,
  renderLayout,
} from './email-layout';

/** Thư 1 (UC02, BR-6, BR-337): mã xác thực + liên kết mở lại đăng ký. */
export function renderVerificationEmail(
  params: IVerificationEmailParams,
): IRenderedEmail {
  const bodyHtml =
    paragraph(`Xin chào <strong>${escapeHtml(params.fullName)}</strong>,`) +
    paragraph(
      `Cảm ơn bạn đã đăng ký <strong>${escapeHtml(params.organizationName)}</strong> trên LearnUP. ` +
        `Nhập mã dưới đây trên màn hình đăng ký để xác thực email:`,
    ) +
    codeBox(params.code) +
    paragraph(
      `Mã có hiệu lực trong <strong>${params.codeTtlMinutes} phút</strong>. ` +
        `Không chia sẻ mã này cho bất kỳ ai.`,
    ) +
    paragraph('Hoặc bấm nút dưới đây để xác thực và tiếp tục thanh toán:') +
    button('Tiếp tục đăng ký', params.reopenLink) +
    paragraph(
      `Đăng ký được giữ tới <strong>${formatDateTimeVi(params.registrationExpiresAt)}</strong>. ` +
        `Sau thời điểm này, bạn cần đăng ký lại.`,
    );

  return {
    subject: `LearnUP - Mã xác thực email: ${params.code}`,
    templateCode: 'REGISTRATION_VERIFICATION_CODE',
    html: renderLayout({
      preheader: `Mã xác thực email của bạn là ${params.code}`,
      heading: 'Xác thực email đăng ký',
      bodyHtml,
    }),
  };
}

/** Thư gửi lại liên kết khi email đã xác thực (BR-276, BR-32). */
export function renderReopenLinkEmail(
  params: IReopenLinkEmailParams,
): IRenderedEmail {
  const bodyHtml =
    paragraph(`Xin chào <strong>${escapeHtml(params.fullName)}</strong>,`) +
    paragraph(
      `Đăng ký <strong>${escapeHtml(params.organizationName)}</strong> của bạn đã xác thực email ` +
        `và đang chờ thanh toán. Bấm nút dưới đây để tiếp tục:`,
    ) +
    button('Tiếp tục thanh toán', params.reopenLink) +
    paragraph(
      `Liên kết này thay cho các liên kết đã gửi trước đó. ` +
        `Đăng ký được giữ tới <strong>${formatDateTimeVi(params.registrationExpiresAt)}</strong>.`,
    );

  return {
    subject: 'LearnUP - Liên kết tiếp tục đăng ký',
    templateCode: 'REGISTRATION_REOPEN_LINK',
    html: renderLayout({
      preheader: 'Tiếp tục thanh toán đăng ký Organization của bạn',
      heading: 'Tiếp tục đăng ký',
      bodyHtml,
    }),
  };
}

/** Thư 2 (UC02.1, BR-20): thanh toán thành công, tài khoản Organizer đã kích hoạt. */
export function renderOrganizerActivatedEmail(
  params: IOrganizerActivatedEmailParams,
): IRenderedEmail {
  const bodyHtml =
    paragraph(`Xin chào <strong>${escapeHtml(params.fullName)}</strong>,`) +
    paragraph(
      `Thanh toán thành công. Không gian đào tạo của <strong>${escapeHtml(params.organizationName)}</strong> ` +
        `đã sẵn sàng và tài khoản Organizer của bạn đã được kích hoạt.`,
    ) +
    paragraph(
      `Gói dịch vụ: <strong>${escapeHtml(params.planName)}</strong>, ` +
        `sử dụng tới <strong>${formatDateTimeVi(params.subscriptionExpiresAt)}</strong>.`,
    ) +
    button('Đăng nhập LearnUP', params.loginUrl) +
    paragraph('Đăng nhập bằng email này và mật khẩu bạn đã đặt khi đăng ký.');

  return {
    subject: 'LearnUP - Tài khoản Organizer đã được kích hoạt',
    templateCode: 'ORGANIZER_ACCOUNT_ACTIVATED',
    html: renderLayout({
      preheader: 'Không gian đào tạo của bạn đã sẵn sàng',
      heading: 'Tài khoản đã được kích hoạt',
      bodyHtml,
    }),
  };
}
