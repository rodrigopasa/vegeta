import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Contacts from "@/pages/Contacts";
import Groups from "@/pages/Groups";
import ScheduledMessages from "@/pages/ScheduledMessages";
import History from "@/pages/History";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import { WhatsAppProvider } from "@/contexts/WhatsAppContext";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { useEffect, useState } from "react";
import Notification from "@/components/Notification";

// Notification types
interface NotificationData {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {children}
      </div>
      
      <footer className="bg-[hsl(var(--whatsapp-dark-green))] text-white p-3 text-center">
        Desenvolvido Por Rodrigo Pasa
      </footer>
    </div>
  );
}

function Router() {
  const { user } = useAuth();

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <ProtectedRoute path="/" component={() => (
        <AuthenticatedLayout>
          <Dashboard />
        </AuthenticatedLayout>
      )} />
      
      <ProtectedRoute path="/contacts" component={() => (
        <AuthenticatedLayout>
          <Contacts />
        </AuthenticatedLayout>
      )} />
      
      <ProtectedRoute path="/groups" component={() => (
        <AuthenticatedLayout>
          <Groups />
        </AuthenticatedLayout>
      )} />
      
      <ProtectedRoute path="/scheduled" component={() => (
        <AuthenticatedLayout>
          <ScheduledMessages />
        </AuthenticatedLayout>
      )} />
      
      <ProtectedRoute path="/history" component={() => (
        <AuthenticatedLayout>
          <History />
        </AuthenticatedLayout>
      )} />
      
      <Route>
        {() => (
          <AuthenticatedLayout>
            <NotFound />
          </AuthenticatedLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  const [notification, setNotification] = useState<NotificationData | null>(null);

  // Show example notification on first load
  useEffect(() => {
    setTimeout(() => {
      setNotification({
        type: 'info',
        title: 'Bem-vindo ao PaZap',
        message: 'Disparador de Mensagens para WhatsApp'
      });
    }, 1000);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WhatsAppProvider>
            <Router />
            
            {notification && (
              <Notification 
                type={notification.type}
                title={notification.title}
                message={notification.message}
                onClose={() => setNotification(null)}
              />
            )}
            
            <Toaster />
          </WhatsAppProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
