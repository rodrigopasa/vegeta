import { useAuth } from "../hooks/use-auth";
import { Spinner } from "@/components/Spinner";
import { Redirect, Route } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
}

export function ProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const auth = useAuth();
  const user = auth?.user;
  const isLoading = auth?.isLoading || false;

  console.log("ProtectedRoute - path:", path, "user:", user, "isLoading:", isLoading);

  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          console.log("ProtectedRoute - carregando...");
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Spinner className="h-8 w-8" />
            </div>
          );
        }

        if (!user) {
          console.log("ProtectedRoute - usuário não autenticado, redirecionando...");
          return <Redirect to="/auth" />;
        }

        console.log("ProtectedRoute - usuário autenticado, renderizando componente");
        return <Component />;
      }}
    </Route>
  );
}