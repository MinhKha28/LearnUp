import { Button, Result } from "antd";
import { useCurrentApp } from "components/context/app.context";
import { Link, useLocation } from "react-router-dom";

interface IProps {
  children: React.ReactNode;
}
const ProtectedRoute = (props: IProps) => {
  const { isAuthenticated, user } = useCurrentApp();
  const location = useLocation();
  // if (isAuthenticated === false) {
  //   return (
  //     <Result
  //       status="404"
  //       title="Không đăng nhập"
  //       subTitle="Bạn vui lòng đăng nhập để sử dụng tính năng này."
  //       extra={
  //         <Link to="/">
  //           <Button type="primary">Back Home</Button>
  //         </Link>
  //       }
  //     />
  //   );
  // }
  const isAdminRole = location.pathname.includes("admin");
  if (isAuthenticated === false && isAdminRole === false) {
    const role = user?.role;
    if (role === "USER") {
      return (
        <Result
          status="403"
          title="403"
          subTitle="Sorry, you are not authorized to access this page."
          extra={
            <Link to="/">
              <Button type="primary">Back Home</Button>
            </Link>
          }
        />
      );
    }
  }
  return <>{props.children}</>;
};

export default ProtectedRoute;
