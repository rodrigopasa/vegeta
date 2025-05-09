import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BellRing, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type NotificationSettings = {
  adminPhoneNumber: string;
  notificationsEnabled: boolean;
};

const defaultSettings: NotificationSettings = {
  adminPhoneNumber: '',
  notificationsEnabled: true
};

const NotificationSettings = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  
  // Consultar as configurações atuais
  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ['/api/whatsapp/notification-settings'],
    select: (data: any) => data?.settings || defaultSettings,
    enabled: open // Só busca quando o diálogo é aberto
  });
  
  // Efeito para atualizar o estado local quando as configurações forem carregadas
  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);
  
  // Função para validar número de telefone
  const validatePhoneNumber = (phone: string) => {
    // Formato básico: código do país + DDD + número (apenas dígitos)
    // Pelo menos 10 dígitos para ser válido (alguns países têm mais, outros menos)
    return /^\d{10,15}$/.test(phone.replace(/\D/g, ''));
  };
  
  // Mutação para salvar as configurações
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      return await fetch('/api/whatsapp/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      }).then(res => {
        if (!res.ok) throw new Error('Falha ao salvar configurações de notificação');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: "Configurações salvas",
        description: "As configurações de notificação foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/notification-settings'] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar configurações",
        description: error.message || "Ocorreu um erro ao salvar as configurações de notificação.",
        variant: "destructive"
      });
    }
  });
  
  const handleSave = () => {
    // Validar número de telefone apenas se as notificações estiverem ativadas
    if (settings.notificationsEnabled && !validatePhoneNumber(settings.adminPhoneNumber)) {
      toast({
        title: "Número de telefone inválido",
        description: "Por favor, insira um número de telefone válido com código do país (ex: 5511999999999).",
        variant: "destructive"
      });
      return;
    }
    
    updateSettingsMutation.mutate(settings);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <BellRing className="h-4 w-4" /> 
          Configurações de Notificação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configurações de Notificação</DialogTitle>
          <DialogDescription>
            Configure como receber notificações sobre o status das mensagens enviadas.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center p-4">Carregando configurações...</div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enable-notifications" className="font-medium">Ativar notificações</Label>
                <p className="text-xs text-gray-500">
                  Receba notificações sobre o status de envio das mensagens
                </p>
              </div>
              <Switch 
                id="enable-notifications" 
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notificationsEnabled: checked }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="admin-phone">Número para notificações</Label>
              <Input
                id="admin-phone"
                type="text"
                placeholder="5511999999999"
                value={settings.adminPhoneNumber}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  adminPhoneNumber: e.target.value 
                }))}
                disabled={!settings.notificationsEnabled}
              />
              <p className="text-xs text-gray-500">
                Digite o número que receberá as notificações com código do país (ex: 5511999999999)
              </p>
            </div>
            
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Nota:</span> As notificações serão enviadas por WhatsApp para este número 
                informando sobre sucesso ou falha no envio de mensagens.
              </p>
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

export default NotificationSettings;