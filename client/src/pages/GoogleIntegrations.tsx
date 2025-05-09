import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Esquemas de validação
const calendarFormSchema = z.object({
  calendarId: z.string().min(1, "ID do calendário é obrigatório"),
});

const sheetsFormSchema = z.object({
  spreadsheetId: z.string().min(1, "ID da planilha é obrigatório"),
  sheetName: z.string().min(1, "Nome da aba é obrigatório"),
});

type CalendarFormValues = z.infer<typeof calendarFormSchema>;
type SheetsFormValues = z.infer<typeof sheetsFormSchema>;

const GoogleIntegrations = () => {
  const { toast } = useToast();
  const [calendarStatus, setCalendarStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sheetsStatus, setSheetsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [calendarConfig, setCalendarConfig] = useState<{ calendarId: string } | null>(null);
  const [sheetsConfig, setSheetsConfig] = useState<{ spreadsheetId: string, sheetName: string } | null>(null);
  
  // Formulário do Calendar
  const calendarForm = useForm<CalendarFormValues>({
    resolver: zodResolver(calendarFormSchema),
    defaultValues: {
      calendarId: "",
    }
  });
  
  // Formulário do Sheets
  const sheetsForm = useForm<SheetsFormValues>({
    resolver: zodResolver(sheetsFormSchema),
    defaultValues: {
      spreadsheetId: "",
      sheetName: "Contatos", // Nome padrão da aba
    }
  });
  
  // Carregar configurações existentes
  useEffect(() => {
    const fetchCalendarConfig = async () => {
      try {
        const response = await fetch('/api/calendar/config');
        if (response.ok) {
          const data = await response.json();
          setCalendarConfig(data);
          calendarForm.reset({
            calendarId: data.calendarId || "",
          });
        }
      } catch (error) {
        console.error('Erro ao carregar configuração do Calendar:', error);
      }
    };
    
    const fetchSheetsConfig = async () => {
      try {
        const response = await fetch('/api/sheets/config');
        if (response.ok) {
          const data = await response.json();
          setSheetsConfig(data);
          sheetsForm.reset({
            spreadsheetId: data.spreadsheetId || "",
            sheetName: data.sheetName || "Contatos",
          });
        }
      } catch (error) {
        console.error('Erro ao carregar configuração do Sheets:', error);
      }
    };
    
    fetchCalendarConfig();
    fetchSheetsConfig();
  }, []);
  
  // Inicializar ou testar conexão do Calendar
  const onSubmitCalendar = async (values: CalendarFormValues) => {
    setCalendarStatus('loading');
    try {
      const response = await fetch('/api/calendar/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      
      if (!response.ok) {
        throw new Error('Falha ao configurar o Google Calendar');
      }
      
      const data = await response.json();
      setCalendarConfig(values);
      setCalendarStatus('success');
      
      toast({
        title: "Google Calendar configurado!",
        description: "A integração com o Google Calendar foi configurada com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao configurar Calendar:', error);
      setCalendarStatus('error');
      
      toast({
        title: "Erro",
        description: "Não foi possível configurar o Google Calendar. Verifique as credenciais e tente novamente.",
        variant: "destructive"
      });
    }
  };
  
  // Inicializar ou testar conexão do Sheets
  const onSubmitSheets = async (values: SheetsFormValues) => {
    setSheetsStatus('loading');
    try {
      const response = await fetch('/api/sheets/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      
      if (!response.ok) {
        throw new Error('Falha ao configurar o Google Sheets');
      }
      
      const data = await response.json();
      setSheetsConfig(values);
      setSheetsStatus('success');
      
      toast({
        title: "Google Sheets configurado!",
        description: "A integração com o Google Sheets foi configurada com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao configurar Sheets:', error);
      setSheetsStatus('error');
      
      toast({
        title: "Erro",
        description: "Não foi possível configurar o Google Sheets. Verifique as credenciais e tente novamente.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Integrações Google</h1>
      
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="calendar">Google Calendar</TabsTrigger>
          <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
        </TabsList>
        
        {/* Configuração do Google Calendar */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Configuração do Google Calendar</CardTitle>
              <CardDescription>
                Configure a integração com o Google Calendar para gerenciar agendamentos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <Alert>
                  <AlertTitle>Como configurar</AlertTitle>
                  <AlertDescription>
                    <ol className="list-decimal list-inside space-y-2 mt-2">
                      <li>Acesse o <a href="https://console.cloud.google.com" target="_blank" className="text-blue-500 hover:underline">Google Cloud Console</a></li>
                      <li>Crie um projeto (se ainda não tiver um)</li>
                      <li>Habilite a API do Google Calendar</li>
                      <li>Crie credenciais de conta de serviço</li>
                      <li>Compartilhe seu calendário com o email da conta de serviço</li>
                      <li>Copie o ID do calendário das configurações do Google Calendar</li>
                    </ol>
                  </AlertDescription>
                </Alert>
                
                <Form {...calendarForm}>
                  <form onSubmit={calendarForm.handleSubmit(onSubmitCalendar)} className="space-y-4">
                    <FormField
                      control={calendarForm.control}
                      name="calendarId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID do Calendário</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="seu.email@gmail.com" />
                          </FormControl>
                          <FormDescription>
                            O ID do calendário que será usado para agendamentos. Geralmente é seu email do Google.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      disabled={calendarStatus === 'loading'}
                      className="w-full"
                    >
                      {calendarStatus === 'loading' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Configurando...
                        </>
                      ) : calendarStatus === 'success' ? (
                        'Configurado com Sucesso!'
                      ) : (
                        'Configurar Google Calendar'
                      )}
                    </Button>
                  </form>
                </Form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Configuração do Google Sheets */}
        <TabsContent value="sheets">
          <Card>
            <CardHeader>
              <CardTitle>Configuração do Google Sheets</CardTitle>
              <CardDescription>
                Configure a integração com o Google Sheets para gerenciar contatos e dados do CRM.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <Alert>
                  <AlertTitle>Como configurar</AlertTitle>
                  <AlertDescription>
                    <ol className="list-decimal list-inside space-y-2 mt-2">
                      <li>Acesse o <a href="https://console.cloud.google.com" target="_blank" className="text-blue-500 hover:underline">Google Cloud Console</a></li>
                      <li>Crie um projeto (se ainda não tiver um)</li>
                      <li>Habilite a API do Google Sheets</li>
                      <li>Crie credenciais de conta de serviço</li>
                      <li>Crie uma planilha no Google Sheets</li>
                      <li>Compartilhe a planilha com o email da conta de serviço (com permissão de edição)</li>
                      <li>Copie o ID da planilha da URL (a parte entre /d/ e /edit)</li>
                    </ol>
                  </AlertDescription>
                </Alert>
                
                <Form {...sheetsForm}>
                  <form onSubmit={sheetsForm.handleSubmit(onSubmitSheets)} className="space-y-4">
                    <FormField
                      control={sheetsForm.control}
                      name="spreadsheetId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID da Planilha</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" />
                          </FormControl>
                          <FormDescription>
                            O ID da planilha do Google Sheets (encontrado na URL entre /d/ e /edit).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={sheetsForm.control}
                      name="sheetName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Aba</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Contatos" />
                          </FormControl>
                          <FormDescription>
                            O nome da aba onde os dados serão armazenados.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      disabled={sheetsStatus === 'loading'}
                      className="w-full"
                    >
                      {sheetsStatus === 'loading' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Configurando...
                        </>
                      ) : sheetsStatus === 'success' ? (
                        'Configurado com Sucesso!'
                      ) : (
                        'Configurar Google Sheets'
                      )}
                    </Button>
                  </form>
                </Form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GoogleIntegrations;