import { DownloadOutlined, PaperClipOutlined } from "@ant-design/icons";
import type { IAttachedFile } from "@/types/submission.types";
import { formatFileSize } from "@/utils/submission.labels";

const SubmissionFileLink = ({ file }: { file: IAttachedFile }) => (
  <a
    className="instructor-submission-file"
    href={file.url ?? undefined}
    target="_blank"
    rel="noreferrer"
  >
    <PaperClipOutlined />
    <span>{file.fileName ?? "Attached file"}</span>
    <small>{formatFileSize(file.sizeBytes)}</small>
    {file.url && <DownloadOutlined />}
  </a>
);

export default SubmissionFileLink;
