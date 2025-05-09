import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import { Settings, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from './ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type RateLimitSettings = {
  messagesPerBatch: number;
  delayBetweenMessages: number;
  delayBetweenBatches: number;
  isEnabled: boolean;
};

const defaultSettings: RateLimitSettings = {
  messagesPerBatch: 10,
  delayBetweenMessages: 3000,
  delayBetweenBatches: 30000,
  isEnabled: true
};

export const RateLimitSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<RateLimitSettings>(defaultSettings);
  
  // Consultar as configurações atuais
  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ['/api/whatsapp/status'],
    select: (data) => data.rateLimitSettings || defaultSettings,
    enabled: open // Só busca quando o diálogo é aberto
  });
  
  // Efeito para atualizar o estado local quando as configurações forem carregadas
  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);
  
  // Mutação para salvar as configurações
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: RateLimitSettings) => {
      return apiRequest('/api/whatsapp/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
    },
    onSuccess: () => {
      toast({
        title: "Configurações salvas",
        description: "Os limites de envio foram atualizados com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar configurações",
        description: error.message || "Ocorreu um erro ao salvar as configurações de limite de envio.",
        variant: "destructive"
      });
    }
  });
  
  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };
  
  // Converter valores de milissegundos para segundos para exibição
  const msToSeconds = (ms: number) => ms / 1000;
  const secondsToMs = (s: number) => s * 1000;
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" /> 
          Configurações Anti-Bloqueio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configurações de Limite de Envio</DialogTitle>
          <DialogDescription>
            Ajuste os limites para prevenir bloqueios do WhatsApp durante envios em massa.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center p-4">Carregando configurações...</div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enable-rate-limit" className="font-medium">Ativar limites de envio</Label>
                <p className="text-xs text-gray-500">
                  Quando ativado, as mensagens serão enviadas em lotes com pausas entre elas
                </p>
              </div>
              <Switch 
                id="enable-rate-limit" 
                checked={settings.isEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, isEnabled: checked }))}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="messages-per-batch">Mensagens por lote: {settings.messagesPerBatch}</Label>
              <Slider 
                id="messages-per-batch"
                min={1} 
                max={20} 
                step={1}
                disabled={!settings.isEnabled}
                value={[settings.messagesPerBatch]} 
                onValueChange={(value) => setSettings(prev => ({ ...prev, messagesPerBatch: value[0] }))}
              />
              <p className="text-xs text-gray-500">
                Quantidade de mensagens enviadas antes de uma pausa maior
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delay-messages">
                Intervalo entre mensagens: {msToSeconds(settings.delayBetweenMessages).toFixed(1)} segundos
              </Label>
              <Slider 
                id="delay-messages"
                min={1} 
                max={10} 
                step={0.5}
                disabled={!settings.isEnabled}
                value={[msToSeconds(settings.delayBetweenMessages)]} 
                onValueChange={(value) => {
                  const valueInMs = secondsToMs(value[0]);
                  setSettings(prev => ({ ...prev, delayBetweenMessages: valueInMs }));
                }}
              />
              <p className="text-xs text-gray-500">
                Tempo de espera entre o envio de cada mensagem no lote
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delay-batches">
                Intervalo entre lotes: {msToSeconds(settings.delayBetweenBatches) / 60} minutos
              </Label>
              <Slider 
                id="delay-batches"
                min={5} 
                max={120} 
                step={5}
                disabled={!settings.isEnabled}
                value={[msToSeconds(settings.delayBetweenBatches) / 60]} 
                onValueChange={(value) => {
                  const valueInMs = secondsToMs(value[0] * 60);
                  setSettings(prev => ({ ...prev, delayBetweenBatches: valueInMs }));
                }}
              />
              <p className="text-xs text-gray-500">
                Pausa mais longa após enviar um lote completo
              </p>
            </div>
            
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Recomendações anti-bloqueio</p>
                  <ul className="text-xs text-amber-700 list-disc pl-4 mt-1 space-y-1">
                    <li>Evite enviar mais de 50 mensagens por hora</li>
                    <li>Use intervalos maiores para grupos grandes</li>
                    <li>Evite mensagens idênticas repetidas</li>
                    <li>Deixe pelo menos 2-3 minutos entre lotes</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button 
            onClick={handleSave} 
            className="gap-2"
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? (
              <>Salvando...</>
            ) : (
              <>
                <Check className="h-4 w-4" /> Salvar Configurações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RateLimitSettings;