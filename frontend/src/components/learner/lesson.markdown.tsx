import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import "./lesson.markdown.scss";

const isExternalLink = (href: string | undefined): href is string => !!href && /^https?:\/\//i.test(href);

/**
 * Nội dung Lesson do Instructor nhập (D42): dựng phần tử React từ cây cú pháp, không render HTML thô,
 * làm sạch bằng schema mặc định của rehype-sanitize và giữ urlTransform mặc định của react-markdown.
 */
const components: Components = {
  a: ({ href, title, children }) =>
    isExternalLink(href) ? (
      <a href={href} title={title} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    ) : (
      <a href={href} title={title}>
        {children}
      </a>
    ),
  img: ({ src, alt, title }) =>
    typeof src === "string" && src.startsWith("https://") ? (
      <img src={src} alt={alt ?? ""} title={title} referrerPolicy="no-referrer" loading="lazy" />
    ) : alt ? (
      <span className="lesson-markdown-image-alt">{alt}</span>
    ) : null,
  table: ({ children }) => (
    <div className="lesson-markdown-table">
      <table>{children}</table>
    </div>
  ),
};

export const LessonMarkdown = ({ content }: { content: string }) => (
  <div className="lesson-markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
);
