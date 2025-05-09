import React, { useState } from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { QRCodeSVG } from 'qrcode.react';
import { PhoneIcon, PlusIcon, Trash2Icon, RefreshCwIcon, PowerIcon, EditIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

const WhatsAppInstances: React.FC = () => {
  const { 
    instances, 
    activeInstanceId, 
    setActiveInstanceId, 
    createInstance,
    updateInstance,
    deleteInstance,
    initializeWhatsApp,
    refreshContacts
  } = useWhatsApp();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<number | null>(null);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const handleCreateInstance = async () => {
    await createInstance(formName, formPhone, formDescription || null);
    resetForm();
    setIsCreateDialogOpen(false);
  };

  const handleUpdateInstance = async () => {
    if (editingInstance !== null) {
      await updateInstance(editingInstance, {
        name: formName,
        phoneNumber: formPhone,
        description: formDescription || null,
        isActive: formIsActive
      });
      resetForm();
      setIsEditDialogOpen(false);
      setEditingInstance(null);
    }
  };

  const handleEditInstance = (instanceId: number) => {
    const instance = instances.find(i => i.id === instanceId);
    if (instance) {
      setFormName(instance.name);
      setFormPhone(instance.phoneNumber);
      setFormDescription(instance.description || '');
      setFormIsActive(instance.isActive);
      setEditingInstance(instanceId);
      setIsEditDialogOpen(true);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormPhone('');
    setFormDescription('');
    setFormIsActive(true);
  };

  const getStatusLabel = (instance: any) => {
    if (instance.isConnected) return { label: 'Conectado', variant: 'success' };
    if (instance.isInitialized) return { label: 'Inicializado', variant: 'warning' };
    return { label: 'Desconectado', variant: 'destructive' };
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Instâncias WhatsApp</h1>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default">
              <PlusIcon className="h-4 w-4 mr-2" />
              Nova Instância
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Instância WhatsApp</DialogTitle>
              <DialogDescription>
                Adicione uma nova instância WhatsApp para gerenciar
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Nome
                </Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="col-span-3"
                  placeholder="Vendas"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Número
                </Label>
                <Input
                  id="phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="col-span-3"
                  placeholder="5511999999999"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Descrição
                </Label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="col-span-3"
                  placeholder="Descrição opcional para esta instância"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleCreateInstance}>
                Criar Instância
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Dialog para editar instância */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Instância WhatsApp</DialogTitle>
              <DialogDescription>
                Atualize as informações da instância
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Nome
                </Label>
                <Input
                  id="edit-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-phone" className="text-right">
                  Número
                </Label>
                <Input
                  id="edit-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Descrição
                </Label>
                <Textarea
                  id="edit-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-active" className="text-right">
                  Ativo
                </Label>
                <div className="col-span-3">
                  <Switch
                    id="edit-active"
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                resetForm();
                setIsEditDialogOpen(false);
                setEditingInstance(null);
              }}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleUpdateInstance}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg">
          <h3 className="text-lg font-medium mb-2">Nenhuma instância configurada</h3>
          <p className="text-muted-foreground mb-4">
            Adicione uma nova instância para começar a usar o WhatsApp
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Adicionar Instância
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {instances.map((instance) => {
            const status = getStatusLabel(instance);
            const isActive = activeInstanceId === instance.id;
            
            return (
              <Card 
                key={instance.id} 
                className={`overflow-hidden ${isActive ? 'ring-2 ring-primary' : ''}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center">
                        <PhoneIcon className="h-5 w-5 mr-2 text-primary" />
                        {instance.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {instance.phoneNumber}
                      </CardDescription>
                    </div>
                    
                    <Badge 
                      variant={status.variant as any} 
                      className="ml-auto"
                    >
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-2">
                  {instance.description && (
                    <p className="text-sm text-muted-foreground mb-4">{instance.description}</p>
                  )}
                  
                  {instance.qrCode && !instance.isConnected ? (
                    <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
                      <p className="text-sm font-medium mb-2">Escaneie o QR Code</p>
                      <div className="bg-white p-2 rounded">
                        <QRCodeSVG value={instance.qrCode} size={150} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Criado em:</span>
                        <span>{new Date(instance.createdAt).toLocaleDateString()}</span>
                      </div>
                      
                      {instance.lastConnectedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Último acesso:</span>
                          <span>{formatDistanceToNow(new Date(instance.lastConnectedAt), { addSuffix: true, locale: pt })}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <span>{instance.isActive ? 'Ativo' : 'Inativo'}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
                
                <CardFooter className="flex justify-between pt-4">
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditInstance(instance.id)}
                    >
                      <EditIcon className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2Icon className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover instância?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso removerá permanentemente a instância
                            "{instance.name}" e todos os seus dados associados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteInstance(instance.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshContacts(instance.id)}
                      disabled={!instance.isConnected}
                    >
                      <RefreshCwIcon className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant={instance.isConnected ? "destructive" : "default"}
                      size="sm"
                      onClick={() => {
                        setActiveInstanceId(instance.id);
                        if (!instance.isConnected) {
                          initializeWhatsApp(instance.id);
                        }
                      }}
                    >
                      <PowerIcon className="h-4 w-4 mr-2" />
                      {instance.isConnected ? "Desconectar" : "Conectar"}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WhatsAppInstances;