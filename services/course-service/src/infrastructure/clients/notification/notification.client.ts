import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  ApiResponse,
  EmailResponse,
  EmailStatus,
  NotificationResponse,
} from './notification.interface';
import { buildCourseApprovalEmail } from './templates/course-approval-email.template';

@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  // Email và in-app đều là service calls:
  // Không truyền JWT hoặc user-context headers.
  private getHeaders() {
    return {
      'x-internal-key': this.configService.getOrThrow<string>(
        'INTERNAL_SERVICE_KEY',
      ),
    };
  }

  private getBaseUrl(): string {
    return this.configService
      .getOrThrow<string>('NOTIFICATION_SERVICE_URL')
      .replace(/\/+$/, '');
  }

  /**
   * Gửi email cho Organizer sau khi Course Submitted.
   */
  async sendCourseApprovalEmail(
    recipientEmail: string,
    courseName: string,
    versionNumber: number,
  ): Promise<EmailStatus> {
    const url = `${this.getBaseUrl()}/api/v1/notifications/email/send`;

    const body = buildCourseApprovalEmail({
      courseName,
      versionNumber,
    });

    const response = await firstValueFrom(
      this.httpService.post<ApiResponse<EmailResponse>>(
        url,
        {
          recipientEmail,
          subject: 'LearnUP - Course awaiting approval',
          body,
          templateCode: 'COURSE_APPROVAL_SUBMITTED',
        },
        { headers: this.getHeaders() },
      ),
    );

    const status = response.data?.data?.status;

    if (status !== 'SENT' && status !== 'SIMULATED' && status !== 'FAILED') {
      throw new Error('Invalid email delivery response');
    }

    if (status === 'FAILED') {
      throw new Error('Notification Service failed to send email');
    }

    if (status === 'SIMULATED') {
      this.logger.warn(
        'Course approval email was simulated, not sent via SMTP',
      );
    }

    return status;
  }

  /**
   * Tạo thông báo trong hệ thống LearnUP.
   */
  async sendCourseApprovalNotification(data: {
    organizationId: string;
    organizerId: string;
    courseId: string;
    courseName: string;
  }): Promise<void> {
    const url = `${this.getBaseUrl()}/api/v1/notifications/send`;

    const response = await firstValueFrom(
      this.httpService.post<ApiResponse<NotificationResponse>>(
        url,
        {
          organizationId: data.organizationId,
          recipientUserId: data.organizerId,
          title: 'Course awaiting approval',
          message: `Course "${data.courseName}" has been submitted for approval.`,
          type: 'COURSE_APPROVAL',
          channel: 'IN_APP',
          metadata: JSON.stringify({
            courseId: data.courseId,
          }),
        },
        { headers: this.getHeaders() },
      ),
    );

    if (typeof response.data?.data?.id !== 'string') {
      throw new Error('Invalid notification response');
    }
  }
}
