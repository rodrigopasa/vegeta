import React, { useState, useEffect } from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { PhoneIcon, PlusIcon, ChevronDownIcon } from 'lucide-react';

const Header: React.FC = () => {
  const { 
    isConnected, 
    isConnecting,
    qrCode, 
    instances, 
    activeInstanceId, 
    setActiveInstanceId,
    initializeWhatsApp,
    activeInstance
  } = useWhatsApp();
  
  const [showQr, setShowQr] = useState(false);
  const [instancesLoaded, setInstancesLoaded] = useState(false);
  
  // Verificar quando as instâncias forem carregadas
  useEffect(() => {
    if (instances && instances.length > 0) {
      setInstancesLoaded(true);
    }
  }, [instances]);
  
  // Handler para quando o usuário seleciona uma instância diferente
  const handleInstanceChange = (value: string) => {
    console.log("Alterando instância para:", value);
    const id = parseInt(value, 10);
    if (!isNaN(id)) {
      setActiveInstanceId(id);
    }
  };

  return (
    <header className="bg-[hsl(var(--whatsapp-dark-green))] text-white py-3 px-4 shadow-md flex items-center justify-between">
      <div className="flex items-center">
        <i className="fas fa-comment-dots text-2xl mr-3"></i>
        <h1 className="text-xl font-semibold">PaZap - Disparador de Mensagens</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Instance selector dropdown */}
        {instances.length > 0 ? (
          <div className="min-w-[250px]">
            <div className="flex items-center bg-white/10 rounded-md px-3 py-2 cursor-pointer">
              <label className="text-sm mr-2 text-white/70">Instância:</label>
              <Select 
                value={activeInstanceId?.toString()} 
                onValueChange={handleInstanceChange}
              >
                <SelectTrigger className="bg-transparent border-none shadow-none text-white p-0 h-auto min-h-0 focus:ring-0">
                  <SelectValue>
                    {activeInstance ? (
                      <div className="flex items-center">
                        <PhoneIcon className="h-4 w-4 mr-2" />
                        <span className="font-medium">{activeInstance.name}</span>
                      </div>
                    ) : (
                      "Selecione uma instância"
                    )}
                  </SelectValue>
                  <ChevronDownIcon className="h-4 w-4 ml-1 text-white/70" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map(instance => (
                    <SelectItem key={instance.id} value={instance.id.toString()}>
                      <div className="flex items-center">
                        <PhoneIcon className="h-4 w-4 mr-2" />
                        {instance.name} ({instance.phoneNumber})
                      </div>
                    </SelectItem>
                  ))}
                  <Link href="/instances" className="flex items-center p-2 m-1 text-sm rounded-md bg-primary/10 hover:bg-primary/20 cursor-pointer">
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Gerenciar Instâncias
                  </Link>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <Link href="/instances">
            <Button variant="default" size="sm" className="bg-white/10 hover:bg-white/20 border-none">
              <PlusIcon className="h-4 w-4 mr-2" />
              Configurar WhatsApp
            </Button>
          </Link>
        )}
        
        {/* Connection status indicator */}
        {activeInstance && (
          <div 
            className="flex items-center bg-white/10 rounded-full px-3 py-1 cursor-pointer"
            onClick={() => {
              if (!isConnected && !isConnecting && qrCode) {
                setShowQr(true);
              } else if (!isConnected && !isConnecting) {
                // Inicializar o WhatsApp
                initializeWhatsApp(activeInstanceId!);
              }
            }}
          >
            <span className={`w-2 h-2 rounded-full mr-2 ${
              isConnecting ? 'bg-yellow-400' : (isConnected ? 'bg-green-400' : 'bg-red-400')
            }`}></span>
            <span className="text-sm">
              {isConnecting ? 'Conectando...' : (isConnected ? 'Conectado' : 'Desconectado')}
            </span>
          </div>
        )}
      </div>
      
      {/* QR Code dialog */}
      <Dialog open={showQr && !!qrCode} onOpenChange={setShowQr}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear QR Code</DialogTitle>
            <DialogDescription>
              Use o aplicativo WhatsApp em seu telefone para escanear o código QR abaixo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-center p-6 bg-white rounded-md">
            {qrCode && <QRCodeSVG value={qrCode} size={250} />}
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Abra o WhatsApp, toque em Menu ou Configurações e selecione WhatsApp Web
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header;
