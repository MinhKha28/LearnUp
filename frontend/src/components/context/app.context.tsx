import { fetchAccountAPI } from "@/services/identity.service";
import type { IUser } from "@/types/identity.types";
import { createContext, useContext, useEffect, useState } from "react";
import PacmanLoader from "react-spinners/PacmanLoader";

interface IAppContext {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  user: IUser | null;
  setUser: (value: IUser | null) => void;
  isAppLoading: boolean;
  setIsAppLoading: (value: boolean) => void;
  carts: unknown[];
  setCarts: (value: unknown[]) => void;
}

const CurrentAppContext = createContext<IAppContext | null>(null);

type TProps = {
  children: React.ReactNode;
};

export const AppProvider = (props: TProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<IUser | null>(null);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const [carts, setCarts] = useState<unknown[]>([]);

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        if (!localStorage.getItem("access_token")) return;
        const res = await fetchAccountAPI();
        if (res.data?.user) {
          setUser(res.data.user);
          setIsAuthenticated(true);
          const savedCarts: unknown = JSON.parse(
            localStorage.getItem("carts") || "[]",
          );
          setCarts(Array.isArray(savedCarts) ? savedCarts : []);
        }
      } catch {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsAppLoading(false);
      }
    };
    fetchAccount();
  }, []);

  return (
    <>
      {isAppLoading === false ? (
        <CurrentAppContext.Provider
          value={{
            isAuthenticated,
            user,
            setIsAuthenticated,
            setUser,
            isAppLoading,
            setIsAppLoading,
            carts,
            setCarts,
          }}
        >
          {props.children}
        </CurrentAppContext.Provider>
      ) : (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <PacmanLoader size={20} color={"#4aeec5"} />
        </div>
      )}
    </>
  );
};

export const useCurrentApp = () => {
  const currentAppContext = useContext(CurrentAppContext);

  if (!currentAppContext) {
    throw new Error(
      "useCurrentUser has to be used within <CurrentUserContext.Provider>",
    );
  }

  return currentAppContext;
};
