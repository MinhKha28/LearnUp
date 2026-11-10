import type {
  IAdminOrganizationListItem,
  IAdminOrganizationListQuery,
  IAccountListItem,
  IAccountListQuery,
  IChangeAccountStatusReq,
  IChangeLearnerStatusReq,
  ICreateAccountReq,
  ICreateRegistrationReq,
  ICreateRegistrationRes,
  IDeleteAccountReq,
  IInstructorDeletion,
  IInstructorDeletionResult,
  IInstructorDetail,
  IInstructorListItem,
  IInstructorStatusChange,
  IInstructorStatusResult,
  ILearnerDetail,
  ILearnerListItem,
  ILearnerStatusResult,
  IOrganizationProfile,
  IUpdateOrganizationReq,
  IPaymentResult,
  IPayRegistrationReq,
  IRegistrationSummary,
  IReinvitationResult,
  ISeatUsage,
  ISubscriptionPlan,
  IUpdateAccountReq,
  IUpdateAccountResult,
  IVerifyEmailOtpReq,
  IVerifyEmailOtpRes,
  IAcceptInvitationReq,
  IAcceptInvitationResult,
  IInvitationInfo,
  IMemberImportPreview,
  IMemberImportResult,
} from "@/types/organization.types";
import { tenantAxios as axios } from "@/services/axios.customize";
import type { ITransferCandidate } from "@/types/course.types";

// UC01 - Xem Subscription Plan (Guest, không cần đăng nhập)
export const getMyOrganizationAPI = () =>
  axios.get<IBackendRes<IOrganizationProfile>>("/api/v1/organizations/me");

export const updateMyOrganizationAPI = (body: IUpdateOrganizationReq) =>
  axios.patch<IBackendRes<IOrganizationProfile>>(
    "/api/v1/organizations/me",
    body,
  );

export const uploadOrganizationLogoAPI = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return axios.put<IBackendRes<IOrganizationProfile>>(
    "/api/v1/organizations/me/logo",
    form,
  );
};

export const removeOrganizationLogoAPI = () =>
  axios.delete<IBackendRes<IOrganizationProfile>>(
    "/api/v1/organizations/me/logo",
  );

export const getSubscriptionPlansAPI = () =>
  axios.get<IBackendRes<ISubscriptionPlan[]>>("/api/v1/subscription-plans");

// UC02 - Đăng ký Organization (Guest)
export const createRegistrationAPI = (body: ICreateRegistrationReq) =>
  axios.post<IBackendRes<ICreateRegistrationRes>>(
    "/api/v1/registrations",
    body,
  );

// UC02.1 - Tóm tắt đăng ký theo liên kết thanh toán
export const getRegistrationByTokenAPI = (token: string) =>
  axios.get<IBackendRes<IRegistrationSummary>>(
    `/api/v1/registrations/${encodeURIComponent(token)}`,
  );

// UC02.1 - Thực hiện thanh toán qua Mock Payment Service
export const payRegistrationAPI = (body: IPayRegistrationReq) =>
  axios.post<IBackendRes<IPaymentResult>>(
    "/api/v1/registrations/payments",
    body,
  );

// UC03 - Xác thực email bằng mã 6 số trong email thứ nhất (trước khi thanh toán)
export const resendRegistrationEmailAPI = (email: string) =>
  axios.post<IBackendRes<ICreateRegistrationRes>>(
    "/api/v1/registrations/resend",
    { email },
  );

export const verifyEmailOtpAPI = (body: IVerifyEmailOtpReq) =>
  axios.post<IBackendRes<IVerifyEmailOtpRes>>(
    "/api/v1/registrations/verify-email",
    body,
  );

// UC12 - Xem danh sách Instructor (Organizer; tổ chức lấy từ danh tính người gọi)
// UC12.4 - keyword, status tùy chọn; không gửi giá trị rỗng
export const getInstructorsAPI = ({
  keyword,
  status,
  ...query
}: IAccountListQuery) =>
  axios.get<IBackendRes<IPageResponse<IInstructorListItem>>>(
    "/api/v1/users/instructors",
    {
      params: {
        ...query,
        ...(keyword ? { keyword } : {}),
        ...(status ? { status } : {}),
      },
    },
  );

// UC12.1 - Xem chi tiết Instructor (Organizer; 400 id sai định dạng, 404 không tìm thấy)
export const getInstructorDetailAPI = (instructorId: string) =>
  axios.get<IBackendRes<IInstructorDetail>>(
    `/api/v1/users/instructors/${encodeURIComponent(instructorId)}`,
  );

// UC12.2 - số chỗ Instructor còn lại (Organizer)
export const getInstructorSeatsAPI = () =>
  axios.get<IBackendRes<ISeatUsage>>("/api/v1/users/instructors/seats");

// UC12.2 - Thêm Instructor (Organizer; backend gửi lời mời qua email)
export const createInstructorAPI = (body: ICreateAccountReq) =>
  axios.post<IBackendRes<IAccountListItem>>("/api/v1/users/instructors", body);

// UC12.8 - tệp mẫu .xlsx. Interceptor trả body lỗi (cũng là Blob) thay vì throw,
// nên chỉ response 200 thật mới là tệp (cùng cách với downloadPromptFileAPI).
export const downloadInstructorImportTemplateAPI =
  async (): Promise<Blob | null> => {
    const res = (await axios.get("/api/v1/users/instructors/imports/template", {
      responseType: "blob",
    })) as unknown as { status?: number; data?: unknown };
    return res.status === 200 && res.data instanceof Blob ? res.data : null;
  };

// UC12.8 - BR-32: xem trước tệp import (không tạo tài khoản)
export const previewInstructorImportAPI = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return axios.post<IBackendRes<IMemberImportPreview>>(
    "/api/v1/users/instructors/imports/preview",
    form,
  );
};

// UC12.8 - BR-32, BR-33: xác nhận; gửi lại cùng tệp và previewDigest, server kiểm lại toàn bộ
export const confirmInstructorImportAPI = (
  file: File,
  previewDigest: string,
) => {
  const form = new FormData();
  form.append("previewDigest", previewDigest);
  form.append("file", file);
  return axios.post<IBackendRes<IMemberImportResult>>(
    "/api/v1/users/instructors/imports",
    form,
  );
};

// UC12.3 - Cập nhật thông tin Instructor (Organizer; đổi email của tài khoản Pending thì gửi lời mời mới)
export const updateInstructorAPI = (
  instructorId: string,
  body: IUpdateAccountReq,
) =>
  axios.patch<IBackendRes<IUpdateAccountResult>>(
    `/api/v1/users/instructors/${encodeURIComponent(instructorId)}`,
    body,
  );

// UC12.3 - BR-279: gợi ý đơn vị công tác đã có trong tổ chức (tối đa 10)
export const getDepartmentSuggestionsAPI = (keyword: string) =>
  axios.get<IBackendRes<string[]>>("/api/v1/users/departments", {
    params: keyword ? { keyword } : {},
  });

// UC13 - Xem danh sách Learner (Organizer; tổ chức lấy từ danh tính người gọi)
export const getLearnersAPI = ({
  keyword,
  status,
  ...query
}: IAccountListQuery) =>
  axios.get<IBackendRes<IPageResponse<ILearnerListItem>>>(
    "/api/v1/users/learners",
    {
      params: {
        ...query,
        ...(keyword ? { keyword } : {}),
        ...(status ? { status } : {}),
      },
    },
  );

// UC13.1 - Xem chi tiết Learner (Organizer; 400 id sai định dạng, 404 không tìm thấy)
export const getLearnerDetailAPI = (learnerId: string) =>
  axios.get<IBackendRes<ILearnerDetail>>(
    `/api/v1/users/learners/${encodeURIComponent(learnerId)}`,
  );

// UC13.2 - số chỗ Learner còn lại (Organizer)
export const getLearnerSeatsAPI = () =>
  axios.get<IBackendRes<ISeatUsage>>("/api/v1/users/learners/seats");

// UC13.2 - Thêm Learner (Organizer; backend gửi lời mời qua email)
export const createLearnerAPI = (body: ICreateAccountReq) =>
  axios.post<IBackendRes<IAccountListItem>>("/api/v1/users/learners", body);

// UC13.3 - Cập nhật thông tin Learner (Organizer; đổi email của tài khoản Pending thì gửi lời mời mới)
export const updateLearnerAPI = (learnerId: string, body: IUpdateAccountReq) =>
  axios.patch<IBackendRes<IUpdateAccountResult>>(
    `/api/v1/users/learners/${encodeURIComponent(learnerId)}`,
    body,
  );

// UC12.5 - chuỗi Course đang phụ trách và Instructor tiếp nhận hợp lệ (cho modal vô hiệu hóa)
export const getInstructorStatusChangeAPI = (instructorId: string) =>
  axios.get<IBackendRes<IInstructorStatusChange>>(
    `/api/v1/users/instructors/${encodeURIComponent(instructorId)}/status-change`,
  );

// UC12.5 - vô hiệu hóa (kèm chuyển quyền, BR-41) hoặc kích hoạt lại Instructor
export const changeInstructorStatusAPI = (
  instructorId: string,
  body: IChangeAccountStatusReq,
) =>
  axios.patch<IBackendRes<IInstructorStatusResult>>(
    `/api/v1/users/instructors/${encodeURIComponent(instructorId)}/status`,
    body,
  );

// UC13.5 - vô hiệu hóa hoặc kích hoạt lại Learner
export const changeLearnerStatusAPI = (
  learnerId: string,
  body: IChangeLearnerStatusReq,
) =>
  axios.patch<IBackendRes<ILearnerStatusResult>>(
    `/api/v1/users/learners/${encodeURIComponent(learnerId)}/status`,
    body,
  );

// UC12.6 - chuỗi Course đang phụ trách và Instructor tiếp nhận hợp lệ (cho dialog xóa)
export const getInstructorDeletionAPI = (instructorId: string) =>
  axios.get<IBackendRes<IInstructorDeletion>>(
    `/api/v1/users/instructors/${encodeURIComponent(instructorId)}/deletion`,
  );

// UC12.6 - xóa Instructor (xóa mềm, kèm chuyển quyền theo BR-51). Lý do đi trong body, không lên URL.
export const deleteInstructorAPI = (
  instructorId: string,
  body: IDeleteAccountReq,
) =>
  axios.delete<IBackendRes<IInstructorDeletionResult>>(
    `/api/v1/users/instructors/${encodeURIComponent(instructorId)}`,
    { data: body },
  );

export const resendInstructorInvitationAPI = (instructorId: string) =>
  axios.post<IBackendRes<IReinvitationResult>>(
    `/api/v1/users/instructors/${encodeURIComponent(instructorId)}/invitations`,
  );

export const resendLearnerInvitationAPI = (learnerId: string) =>
  axios.post<IBackendRes<IReinvitationResult>>(
    `/api/v1/users/learners/${encodeURIComponent(learnerId)}/invitations`,
  );

// UC04 - Xem lời mời trước khi đặt mật khẩu
export const getInvitationAPI = (token: string) =>
  axios.get<IBackendRes<IInvitationInfo>>(
    `/api/v1/invitations/${encodeURIComponent(token)}`,
  );

// UC04 - Đặt mật khẩu và kích hoạt tài khoản
export const acceptInvitationAPI = (body: IAcceptInvitationReq) =>
  axios.post<IBackendRes<IAcceptInvitationResult>>(
    "/api/v1/invitations/accept",
    body,
  );

// UC44 - Admin xem danh sách Organization; mặc định backend ẩn Cancelled, chỉ gửi cờ khi cần hiện
export const getAdminOrganizationsAPI = ({
  includeCancelled,
  ...query
}: IAdminOrganizationListQuery) =>
  axios.get<IBackendRes<IPageResponse<IAdminOrganizationListItem>>>(
    "/api/v1/admin/organizations",
    {
      params: {
        ...query,
        ...(includeCancelled ? { includeCancelled: true } : {}),
      },
    },
  );
export const getTransferCandidatesAPI = (excludeInstructorId: string) =>
  axios.get<IBackendRes<ITransferCandidate[]>>(
    "/api/v1/users/instructors/transfer-candidates",
    {
      params: { excludeInstructorId },
    },
  );
