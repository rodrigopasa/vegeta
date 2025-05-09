import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useCallback } from 'react';

// Schema para formulário do prompt principal
const systemPromptSchema = z.object({
  prompt: z.string().min(10, {
    message: "O prompt deve ter pelo menos 10 caracteres",
  }),
});

// Schema para formulário de serviços
const serviceSchema = z.object({
  name: z.string().min(2, {
    message: "O nome do serviço deve ter pelo menos 2 caracteres",
  }),
  description: z.string().min(10, {
    message: "A descrição deve ter pelo menos 10 caracteres",
  }),
  duration: z.string().min(1, {
    message: "Defina a duração do serviço",
  }),
  price: z.string().optional(),
});

// Schema para formulário de horários
const scheduleSchema = z.object({
  dayOfWeek: z.enum(["1", "2", "3", "4", "5", "6", "0"], {
    message: "Escolha um dia da semana",
  }),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Formato de hora inválido (HH:MM)",
  }),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Formato de hora inválido (HH:MM)",
  }),
  isAvailable: z.boolean().default(true),
});

// Schema para formulário de respostas predefinidas
const faqSchema = z.object({
  question: z.string().min(5, {
    message: "A pergunta deve ter pelo menos 5 caracteres",
  }),
  answer: z.string().min(10, {
    message: "A resposta deve ter pelo menos 10 caracteres",
  }),
});

interface Service {
  id: string;
  name: string;
  description: string;
  duration: string;
  price?: string;
}

interface Schedule {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const dayNames = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", 
  "Quinta-feira", "Sexta-feira", "Sábado"
];

const ChatbotSettings = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  
  // Formulário para prompt principal
  const systemPromptForm = useForm<z.infer<typeof systemPromptSchema>>({
    resolver: zodResolver(systemPromptSchema),
    defaultValues: {
      prompt: `Você é um assistente virtual de uma empresa. Ajude os clientes de forma educada e profissional.
  
Suas principais funções são:
1. Responder dúvidas sobre produtos e serviços
2. Agendar consultas ou compromissos
3. Capturar informações de contato para o CRM

Quando o cliente quiser agendar um compromisso, colete estas informações:
- Nome completo
- Data e horário desejados
- Tipo de serviço
- Número de telefone para confirmação
- Email (opcional)

Horários disponíveis para agendamento: segunda a sexta, das 8h às 18h.

Seja conciso, educado e solícito.`,
    },
  });
  
  // Formulário para adicionar serviço
  const serviceForm = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      duration: "60",
      price: "",
    },
  });
  
  // Formulário para adicionar horário
  const scheduleForm = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      dayOfWeek: "1",
      startTime: "08:00",
      endTime: "17:00",
      isAvailable: true,
    },
  });
  
  // Formulário para adicionar FAQ
  const faqForm = useForm<z.infer<typeof faqSchema>>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: "",
      answer: "",
    },
  });
  
  // Efeito para carregar as configurações salvas
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        
        // Carregar prompt principal
        const promptResponse = await fetch('/api/chatbot/settings/prompt');
        if (promptResponse.ok) {
          const data = await promptResponse.json();
          if (data.prompt) {
            systemPromptForm.setValue('prompt', data.prompt);
          }
        }
        
        // Carregar serviços
        const servicesResponse = await fetch('/api/chatbot/settings/services');
        if (servicesResponse.ok) {
          const data = await servicesResponse.json();
          if (Array.isArray(data)) {
            setServices(data);
          }
        }
        
        // Carregar horários
        const schedulesResponse = await fetch('/api/chatbot/settings/schedules');
        if (schedulesResponse.ok) {
          const data = await schedulesResponse.json();
          if (Array.isArray(data)) {
            setSchedules(data);
          }
        }
        
        // Carregar FAQs
        const faqsResponse = await fetch('/api/chatbot/settings/faqs');
        if (faqsResponse.ok) {
          const data = await faqsResponse.json();
          if (Array.isArray(data)) {
            setFaqs(data);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as configurações",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // Função para salvar o prompt principal
  const onSaveSystemPrompt = async (data: z.infer<typeof systemPromptSchema>) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/chatbot/settings/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Erro ao salvar prompt');
      }
      
      toast({
        title: "Sucesso",
        description: "Prompt principal atualizado com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar prompt:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o prompt",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para adicionar serviço
  const onAddService = (data: z.infer<typeof serviceSchema>) => {
    const newService: Service = {
      id: Date.now().toString(),
      ...data
    };
    
    setServices([...services, newService]);
    serviceForm.reset();
    saveServices([...services, newService]);
  };
  
  // Função para remover serviço
  const removeService = (id: string) => {
    const updatedServices = services.filter(service => service.id !== id);
    setServices(updatedServices);
    saveServices(updatedServices);
  };
  
  // Função para salvar serviços no servidor
  const saveServices = async (updatedServices: Service[]) => {
    try {
      const response = await fetch('/api/chatbot/settings/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedServices)
      });
      
      if (!response.ok) {
        throw new Error('Erro ao salvar serviços');
      }
      
      toast({
        title: "Sucesso",
        description: "Serviços atualizados com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar serviços:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar os serviços",
        variant: "destructive"
      });
    }
  };
  
  // Função para adicionar horário
  const onAddSchedule = (data: z.infer<typeof scheduleSchema>) => {
    const newSchedule: Schedule = {
      id: Date.now().toString(),
      ...data
    };
    
    setSchedules([...schedules, newSchedule]);
    scheduleForm.reset();
    saveSchedules([...schedules, newSchedule]);
  };
  
  // Função para remover horário
  const removeSchedule = (id: string) => {
    const updatedSchedules = schedules.filter(schedule => schedule.id !== id);
    setSchedules(updatedSchedules);
    saveSchedules(updatedSchedules);
  };
  
  // Função para salvar horários no servidor
  const saveSchedules = async (updatedSchedules: Schedule[]) => {
    try {
      const response = await fetch('/api/chatbot/settings/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedSchedules)
      });
      
      if (!response.ok) {
        throw new Error('Erro ao salvar horários');
      }
      
      toast({
        title: "Sucesso",
        description: "Horários atualizados com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar horários:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar os horários",
        variant: "destructive"
      });
    }
  };
  
  // Função para adicionar FAQ
  const onAddFAQ = (data: z.infer<typeof faqSchema>) => {
    const newFAQ: FAQ = {
      id: Date.now().toString(),
      ...data
    };
    
    setFaqs([...faqs, newFAQ]);
    faqForm.reset();
    saveFAQs([...faqs, newFAQ]);
  };
  
  // Função para remover FAQ
  const removeFAQ = (id: string) => {
    const updatedFAQs = faqs.filter(faq => faq.id !== id);
    setFaqs(updatedFAQs);
    saveFAQs(updatedFAQs);
  };
  
  // Função para salvar FAQs no servidor
  const saveFAQs = async (updatedFAQs: FAQ[]) => {
    try {
      const response = await fetch('/api/chatbot/settings/faqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedFAQs)
      });
      
      if (!response.ok) {
        throw new Error('Erro ao salvar FAQs');
      }
      
      toast({
        title: "Sucesso",
        description: "FAQs atualizadas com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar FAQs:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as FAQs",
        variant: "destructive"
      });
    }
  };
  
  // Função para gerar novo prompt baseado em todas as configurações
  const generateFullPrompt = useCallback(() => {
    let prompt = systemPromptForm.getValues('prompt');
    
    // Adicionar informações sobre serviços
    if (services.length > 0) {
      prompt += "\n\n### Serviços Oferecidos:\n";
      services.forEach(service => {
        prompt += `- ${service.name}: ${service.description}`;
        if (service.price) {
          prompt += ` (R$ ${service.price})`;
        }
        prompt += `. Duração: ${service.duration} minutos.\n`;
      });
    }
    
    // Adicionar informações sobre horários
    if (schedules.length > 0) {
      prompt += "\n\n### Horários Disponíveis:\n";
      // Agrupar por dia da semana
      const schedulesByDay: { [key: string]: Schedule[] } = {};
      
      schedules.forEach(schedule => {
        if (schedule.isAvailable) {
          if (!schedulesByDay[schedule.dayOfWeek]) {
            schedulesByDay[schedule.dayOfWeek] = [];
          }
          schedulesByDay[schedule.dayOfWeek].push(schedule);
        }
      });
      
      // Adicionar horários agrupados por dia
      Object.keys(schedulesByDay).sort().forEach(day => {
        const daySchedules = schedulesByDay[day];
        prompt += `- ${dayNames[parseInt(day)]}: `;
        
        const timeRanges = daySchedules.map(s => `${s.startTime} às ${s.endTime}`);
        prompt += timeRanges.join(", ");
        prompt += "\n";
      });
    }
    
    // Adicionar FAQs (respostas predefinidas)
    if (faqs.length > 0) {
      prompt += "\n\n### Respostas para Perguntas Frequentes:\n";
      faqs.forEach(faq => {
        prompt += `Pergunta: "${faq.question}"\n`;
        prompt += `Resposta: "${faq.answer}"\n\n`;
      });
    }
    
    return prompt;
  }, [services, schedules, faqs, systemPromptForm]);
  
  // Função para atualizar prompt completo
  const updateFullPrompt = async () => {
    try {
      setIsLoading(true);
      
      const fullPrompt = generateFullPrompt();
      
      const response = await fetch('/api/chatbot/settings/full-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: fullPrompt })
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar prompt completo');
      }
      
      toast({
        title: "Sucesso",
        description: "Prompt completo atualizado com sucesso."
      });
    } catch (error) {
      console.error('Erro ao atualizar prompt completo:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o prompt completo",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Configurações do Chatbot</h1>
      
      <Tabs defaultValue="prompt" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="prompt">Instruções Gerais</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="schedule">Horários</TabsTrigger>
          <TabsTrigger value="faqs">Respostas Predefinidas</TabsTrigger>
        </TabsList>
        
        {/* Tab de Instruções Gerais */}
        <TabsContent value="prompt">
          <Card>
            <CardHeader>
              <CardTitle>Instruções Gerais para a IA</CardTitle>
              <CardDescription>
                Configure as instruções básicas que definem como a IA deve se comportar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...systemPromptForm}>
                <form onSubmit={systemPromptForm.handleSubmit(onSaveSystemPrompt)} className="space-y-4">
                  <FormField
                    control={systemPromptForm.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instruções do Sistema</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Digite aqui as instruções gerais para o chatbot..."
                            rows={12}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Estas são as instruções principais que serão enviadas para a OpenAI 
                          para definir o comportamento, tom e capacidades do chatbot.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Instruções"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab de Serviços */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Serviços Oferecidos</CardTitle>
              <CardDescription>
                Adicione os serviços que sua empresa oferece para que o chatbot possa informar os clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <Form {...serviceForm}>
                  <form onSubmit={serviceForm.handleSubmit(onAddService)} className="space-y-4 border p-4 rounded-md">
                    <h3 className="text-lg font-medium">Adicionar Novo Serviço</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={serviceForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Serviço</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Consulta Odontológica" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={serviceForm.control}
                          name="duration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duração (min)</FormLabel>
                              <FormControl>
                                <Input type="number" min="5" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={serviceForm.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Preço (opcional)</FormLabel>
                              <FormControl>
                                <Input placeholder="R$ 0,00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    <FormField
                      control={serviceForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição do Serviço</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Descreva o serviço detalhadamente..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit">
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Serviço
                    </Button>
                  </form>
                </Form>
                
                <div className="border rounded-md p-4">
                  <h3 className="text-lg font-medium mb-4">Serviços Cadastrados</h3>
                  {services.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum serviço cadastrado. Adicione um serviço acima.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Duração</TableHead>
                          <TableHead>Preço</TableHead>
                          <TableHead className="w-24">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {services.map(service => (
                          <TableRow key={service.id}>
                            <TableCell className="font-medium">{service.name}</TableCell>
                            <TableCell className="max-w-xs truncate">{service.description}</TableCell>
                            <TableCell>{service.duration} min</TableCell>
                            <TableCell>{service.price || '-'}</TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeService(service.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab de Horários */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Disponibilidade de Horários</CardTitle>
              <CardDescription>
                Configure os horários disponíveis para agendamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <Form {...scheduleForm}>
                  <form onSubmit={scheduleForm.handleSubmit(onAddSchedule)} className="space-y-4 border p-4 rounded-md">
                    <h3 className="text-lg font-medium">Adicionar Horário Disponível</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <FormField
                        control={scheduleForm.control}
                        name="dayOfWeek"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dia da Semana</FormLabel>
                            <FormControl>
                              <select
                                className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background"
                                {...field}
                              >
                                <option value="1">Segunda-feira</option>
                                <option value="2">Terça-feira</option>
                                <option value="3">Quarta-feira</option>
                                <option value="4">Quinta-feira</option>
                                <option value="5">Sexta-feira</option>
                                <option value="6">Sábado</option>
                                <option value="0">Domingo</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={scheduleForm.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Horário Inicial</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={scheduleForm.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Horário Final</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={scheduleForm.control}
                        name="isAvailable"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-end space-x-2">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="h-5 w-5"
                              />
                            </FormControl>
                            <FormLabel>Disponível</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button type="submit">
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Horário
                    </Button>
                  </form>
                </Form>
                
                <div className="border rounded-md p-4">
                  <h3 className="text-lg font-medium mb-4">Horários Cadastrados</h3>
                  {schedules.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum horário cadastrado. Adicione um horário acima.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dia da Semana</TableHead>
                          <TableHead>Horário Inicial</TableHead>
                          <TableHead>Horário Final</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-24">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedules.map(schedule => (
                          <TableRow key={schedule.id}>
                            <TableCell>{dayNames[parseInt(schedule.dayOfWeek)]}</TableCell>
                            <TableCell>{schedule.startTime}</TableCell>
                            <TableCell>{schedule.endTime}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                schedule.isAvailable 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {schedule.isAvailable ? 'Disponível' : 'Indisponível'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeSchedule(schedule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab de FAQs */}
        <TabsContent value="faqs">
          <Card>
            <CardHeader>
              <CardTitle>Respostas Predefinidas (FAQs)</CardTitle>
              <CardDescription>
                Configure respostas para perguntas frequentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                <Form {...faqForm}>
                  <form onSubmit={faqForm.handleSubmit(onAddFAQ)} className="space-y-4 border p-4 rounded-md">
                    <h3 className="text-lg font-medium">Adicionar Pergunta e Resposta</h3>
                    <FormField
                      control={faqForm.control}
                      name="question"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pergunta</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Qual o horário de funcionamento?" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={faqForm.control}
                      name="answer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Resposta</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Digite a resposta para esta pergunta..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit">
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar FAQ
                    </Button>
                  </form>
                </Form>
                
                <div className="border rounded-md p-4">
                  <h3 className="text-lg font-medium mb-4">FAQs Cadastradas</h3>
                  {faqs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhuma FAQ cadastrada. Adicione perguntas e respostas acima.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {faqs.map(faq => (
                        <div key={faq.id} className="border rounded-md p-4">
                          <div className="flex justify-between">
                            <h4 className="font-medium">{faq.question}</h4>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeFAQ(faq.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="mt-2 text-muted-foreground">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Aplicar Configurações ao Chatbot</CardTitle>
            <CardDescription>
              Atualiza o prompt completo do chatbot com todas as informações configuradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">
                Depois de fazer alterações nas configurações, clique no botão ao lado 
                para aplicar todas as mudanças ao prompt do chatbot.
              </p>
              <Button onClick={updateFullPrompt} disabled={isLoading} className="ml-4">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  "Aplicar Configurações"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChatbotSettings;