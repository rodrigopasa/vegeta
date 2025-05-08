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
import { WhatsAppProvider } from "@/contexts/WhatsAppContext";
import { useEffect, useState } from "react";
import Notification from "@/components/Notification";

// Notification types
interface NotificationData {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

function Router() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/groups" component={Groups} />
        <Route path="/scheduled" component={ScheduledMessages} />
        <Route path="/history" component={History} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  const [notification, setNotification] = useState<NotificationData | null>(null);

  // Show example notification on first load
  useEffect(() => {
    setTimeout(() => {
      setNotification({
        type: 'info',
        title: 'Bem-vindo ao WhatsApp Scheduler',
        message: 'Conecte seu WhatsApp para começar a enviar e agendar mensagens'
      });
    }, 1000);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WhatsAppProvider>
          <div className="flex flex-col h-screen">
            <Header />
            <Router />
          </div>
          
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
