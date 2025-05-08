import React from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Spinner } from '@/components/Spinner';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose }) => {
  const { qrCode, isConnecting } = useWhatsApp();

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <Card className="max-w-md w-full p-4">
        <CardHeader className="text-center">
          <CardTitle>Conectar WhatsApp</CardTitle>
          <CardDescription>Escaneie o QR code com seu WhatsApp</CardDescription>
        </CardHeader>
        
        <CardContent>
          {qrCode ? (
            <div className="bg-gray-100 p-4 rounded-lg flex items-center justify-center">
              <div className="bg-white p-3 inline-block">
                <QRCodeSVG 
                  value={qrCode} 
                  size={240}
                  bgColor={"#ffffff"}
                  fgColor={"#000000"}
                  level={"L"}
                  includeMargin={true}
                />
              </div>
            </div>
          ) : (
            <div className="h-60 w-full flex items-center justify-center">
              <div className="text-center">
                <div className="mb-4">
                  <Spinner className="h-8 w-8 text-[hsl(var(--whatsapp-green))]" />
                </div>
                <p className="text-[hsl(var(--whatsapp-secondary))]">
                  Gerando código QR...
                </p>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col items-center">
          <p className="text-sm text-[hsl(var(--whatsapp-secondary))] mb-4">
            {isConnecting && (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Aguardando a conexão...
              </>
            )}
          </p>
          <Button
            variant="outline"
            onClick={onClose}
            className="text-[hsl(var(--whatsapp-dark-green))]"
          >
            Cancelar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};



export default QRCodeModal;
