import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Calendar, FileSpreadsheet } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

// Interface para as configurações do Google Calendar
interface CalendarConfig {
  calendarId: string | null;
  hasCredentials: boolean;
  isInitialized: boolean;
}

// Interface para as configurações do Google Sheets
interface SheetsConfig {
  spreadsheetId: string | null;
  hasCredentials: boolean;
  isInitialized: boolean;
}

const GoogleIntegrations: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("calendar");
  
  // Estados para Google Calendar
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig | null>(null);
  const [calendarId, setCalendarId] = useState<string>("");
  const [isCalendarLoading, setIsCalendarLoading] = useState<boolean>(false);
  
  // Estados para Google Sheets
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string>("");
  const [sheetName, setSheetName] = useState<string>("Contatos");
  const [isSheetsLoading, setIsSheetsLoading] = useState<boolean>(false);

  // Carrega as configurações atuais do Google Calendar
  const loadCalendarConfig = async () => {
    try {
      const response = await fetch('/api/calendar/config');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      setCalendarConfig(data);
      if (data.calendarId) {
        setCalendarId(data.calendarId);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração do Google Calendar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a configuração do Google Calendar",
        variant: "destructive"
      });
    }
  };

  // Carrega as configurações atuais do Google Sheets
  const loadSheetsConfig = async () => {
    try {
      const response = await fetch('/api/sheets/config');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSheetsConfig(data);
      if (data.spreadsheetId) {
        setSpreadsheetId(data.spreadsheetId);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração do Google Sheets:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a configuração do Google Sheets",
        variant: "destructive"
      });
    }
  };

  // Inicializa o Google Calendar com o ID fornecido
  const initializeCalendar = async () => {
    if (!calendarId.trim()) {
      toast({
        title: "Atenção",
        description: "Por favor, informe o ID do calendário",
        variant: "destructive"
      });
      return;
    }

    setIsCalendarLoading(true);
    try {
      const response = await apiRequest({
        url: '/api/calendar/initialize',
        method: 'POST',
        data: { calendarId }
      });
      
      toast({
        title: "Sucesso",
        description: "Google Calendar inicializado com sucesso",
        variant: "default"
      });
      
      // Recarrega a configuração
      await loadCalendarConfig();
    } catch (error) {
      console.error('Erro ao inicializar Google Calendar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível inicializar o Google Calendar. Verifique o ID do calendário e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsCalendarLoading(false);
    }
  };

  // Inicializa o Google Sheets com o ID fornecido
  const initializeSheets = async () => {
    if (!spreadsheetId.trim()) {
      toast({
        title: "Atenção",
        description: "Por favor, informe o ID da planilha",
        variant: "destructive"
      });
      return;
    }

    setIsSheetsLoading(true);
    try {
      const response = await apiRequest({
        url: '/api/sheets/initialize',
        method: 'POST',
        data: { 
          spreadsheetId,
          sheetName: sheetName.trim() || "Contatos"
        }
      });
      
      toast({
        title: "Sucesso",
        description: "Google Sheets inicializado com sucesso",
        variant: "default"
      });
      
      // Recarrega a configuração
      await loadSheetsConfig();
    } catch (error) {
      console.error('Erro ao inicializar Google Sheets:', error);
      toast({
        title: "Erro",
        description: "Não foi possível inicializar o Google Sheets. Verifique o ID da planilha e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSheetsLoading(false);
    }
  };

  // Carrega as configurações ao montar o componente
  useEffect(() => {
    loadCalendarConfig();
    loadSheetsConfig();
  }, []);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Integrações Google</h1>
      
      <Tabs defaultValue="calendar" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Google Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="sheets" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Google Sheets</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Google Calendar Tab */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Configurar Integração com Google Calendar</CardTitle>
              <CardDescription>
                Configure seu calendário do Google para gerenciar agendamentos diretamente pelo sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calendarConfig && !calendarConfig.hasCredentials && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Credenciais não configuradas</AlertTitle>
                  <AlertDescription>
                    As credenciais do Google não estão configuradas corretamente.
                    Você precisa configurar as variáveis de ambiente GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY.
                  </AlertDescription>
                </Alert>
              )}
              
              {calendarConfig && calendarConfig.hasCredentials && calendarConfig.isInitialized && (
                <Alert variant="default" className="mb-4 bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle>Integração ativa</AlertTitle>
                  <AlertDescription>
                    O Google Calendar está configurado e ativo.
                    ID atual: <code className="bg-green-100 px-1 py-0.5 rounded">{calendarConfig.calendarId}</code>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="calendarId">ID do Google Calendar</Label>
                  <Input
                    id="calendarId"
                    placeholder="exemplo@group.calendar.google.com"
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Você pode encontrar o ID do seu calendário nas configurações do Google Calendar.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => loadCalendarConfig()}>
                Cancelar
              </Button>
              <Button 
                onClick={initializeCalendar} 
                disabled={isCalendarLoading || !calendarConfig?.hasCredentials}
              >
                {isCalendarLoading ? "Configurando..." : "Configurar Calendário"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Google Sheets Tab */}
        <TabsContent value="sheets">
          <Card>
            <CardHeader>
              <CardTitle>Configurar Integração com Google Sheets</CardTitle>
              <CardDescription>
                Configure sua planilha do Google para armazenar contatos e registros do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sheetsConfig && !sheetsConfig.hasCredentials && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Credenciais não configuradas</AlertTitle>
                  <AlertDescription>
                    As credenciais do Google não estão configuradas corretamente.
                    Você precisa configurar as variáveis de ambiente GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY.
                  </AlertDescription>
                </Alert>
              )}
              
              {sheetsConfig && sheetsConfig.hasCredentials && sheetsConfig.isInitialized && (
                <Alert variant="default" className="mb-4 bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle>Integração ativa</AlertTitle>
                  <AlertDescription>
                    O Google Sheets está configurado e ativo.
                    ID atual: <code className="bg-green-100 px-1 py-0.5 rounded">{sheetsConfig.spreadsheetId}</code>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="spreadsheetId">ID da Planilha Google</Label>
                  <Input
                    id="spreadsheetId"
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Você pode encontrar o ID da planilha na URL do Google Sheets:
                    <br />
                    <code className="text-xs">https://docs.google.com/spreadsheets/d/[ID_DA_PLANILHA]/edit</code>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sheetName">Nome da Aba para Contatos (opcional)</Label>
                  <Input
                    id="sheetName"
                    placeholder="Contatos"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Se a aba não existir, ela será criada automaticamente.
                    Se não informado, será usado o nome "Contatos".
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => loadSheetsConfig()}>
                Cancelar
              </Button>
              <Button 
                onClick={initializeSheets} 
                disabled={isSheetsLoading || !sheetsConfig?.hasCredentials}
              >
                {isSheetsLoading ? "Configurando..." : "Configurar Planilha"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GoogleIntegrations;