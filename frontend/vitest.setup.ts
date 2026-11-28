// Các test định dạng hạn giả định giờ máy là GMT+7
process.env.TZ = "Asia/Ho_Chi_Minh";

// jsdom exposes transitions but never dispatches animation completion events.
// Ant Design's CommonJS consumers share this mutable module.exports object.
const motion = await import("rc-motion/lib/util/motion") as {
  default: { supportTransition: boolean };
};
motion.default.supportTransition = false;
