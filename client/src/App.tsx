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
import ChatbotDemo from "@/pages/ChatbotDemo";
import ChatbotSettings from "@/pages/ChatbotSettings";
import GoogleIntegrations from "@/pages/GoogleIntegrations";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import { WhatsAppProvider } from "@/contexts/WhatsAppContext";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
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
      <div className="flex flex-1 overflow-hidden bg-[hsl(var(--background-light))]">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4">
          {children}
        </main>
      </div>
      
      <footer className="bg-[hsl(var(--primary-dark))] text-white py-3 text-center text-sm font-medium">
        <div className="flex items-center justify-center space-x-1">
          <span>Desenvolvido Por</span>
          <span className="font-bold">Rodrigo Pasa</span>
          <span className="text-white/70 text-xs ml-2">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

function Router() {
  const auth = useAuth();
  const user = auth?.user;

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
      
      <ProtectedRoute path="/chatbot" component={() => (
        <AuthenticatedLayout>
          <ChatbotDemo />
        </AuthenticatedLayout>
      )} />
      
      <ProtectedRoute path="/chatbot-settings" component={() => (
        <AuthenticatedLayout>
          <ChatbotSettings />
        </AuthenticatedLayout>
      )} />
      
      <ProtectedRoute path="/google-integrations" component={() => (
        <AuthenticatedLayout>
          <GoogleIntegrations />
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
