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

  // O importante aqui é garantir que o usuário está autenticado antes de renderizar o conteúdo protegido
  return (
    <Route path={path}>
      {() => {
        if (isLoading) {
          console.log("ProtectedRoute - carregando dados do usuário...");
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Spinner className="h-8 w-8" />
              <span className="ml-2">Verificando autenticação...</span>
            </div>
          );
        }

        // Se não estiver carregando e o usuário não existir, redireciona para a página de login
        if (!user) {
          console.log("ProtectedRoute - usuário não autenticado, redirecionando para /auth");
          return <Redirect to="/auth" />;
        }

        // Se chegou aqui, o usuário está autenticado, renderizar o componente protegido
        console.log("ProtectedRoute - usuário autenticado:", user.username, "renderizando componente");
        return <Component />;
      }}
    </Route>
  );
}