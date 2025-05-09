import React, { useRef, useState, ChangeEvent, useEffect, memo } from 'react';
import { Paperclip, Loader, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Removemos o import do toast que estava causando problemas
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from './Spinner';

interface FileUploaderProps {
  onFileUploaded: (data: {
    hasMedia: boolean;
    mediaFile: File | null;
    mediaType: string;
    mediaPath: string;
    mediaName: string;
    mediaCaption: string;
  }) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = memo(({ onFileUploaded }) => {
  // Removido o hook que estava causando problemas
  const mediaInputRef = useRef<HTMLInputElement>(null);
  
  // Estado do upload
  const [hasMedia, setHasMedia] = useState<boolean>(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<string>('');
  const [mediaPath, setMediaPath] = useState<string>('');
  const [mediaName, setMediaName] = useState<string>('');
  const [mediaCaption, setMediaCaption] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadId] = useState<string>(Math.random().toString(36).substring(2, 10));

  // Usar useEffect para persistir o estado em um armazenamento local
  useEffect(() => {
    if (hasMedia && mediaFile && mediaPath) {
      // Salvar estado no sessionStorage para persistir entre renderizações
      const stateToSave = {
        hasMedia,
        mediaName,
        mediaType,
        mediaPath,
        mediaCaption,
        fileSize: mediaFile ? mediaFile.size : 0
      };
      
      try {
        sessionStorage.setItem(`fileUploader-${uploadId}`, JSON.stringify(stateToSave));
      } catch (error) {
        console.error('Error saving state to sessionStorage:', error);
      }
    }
  }, [hasMedia, mediaName, mediaType, mediaPath, mediaCaption, mediaFile, uploadId]);
  
  // Recuperar estado do sessionStorage na montagem do componente
  useEffect(() => {
    try {
      const savedState = sessionStorage.getItem(`fileUploader-${uploadId}`);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        if (parsedState.hasMedia && parsedState.mediaPath) {
          // Restaurar apenas o estado necessário
          setHasMedia(parsedState.hasMedia);
          setMediaName(parsedState.mediaName);
          setMediaType(parsedState.mediaType);
          setMediaPath(parsedState.mediaPath);
          setMediaCaption(parsedState.mediaCaption || '');
          
          // Não podemos restaurar o objeto File diretamente, 
          // mas podemos criar um placeholder para fins de UI
          const dummyFile = new File([], parsedState.mediaName, {
            type: parsedState.mediaType
          });
          setMediaFile(dummyFile);
          
          // Notificar o componente pai
          onFileUploaded({
            hasMedia: parsedState.hasMedia,
            mediaFile: dummyFile,
            mediaType: parsedState.mediaType,
            mediaPath: parsedState.mediaPath,
            mediaName: parsedState.mediaName,
            mediaCaption: parsedState.mediaCaption || ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading state from sessionStorage:', error);
    }
  }, [onFileUploaded, uploadId]);

  // Limpar o estado
  const clearFileState = () => {
    setHasMedia(false);
    setMediaFile(null);
    setMediaType('');
    setMediaPath('');
    setMediaName('');
    setMediaCaption('');
    setUploadError(null);
    
    // Limpar também do sessionStorage
    try {
      sessionStorage.removeItem(`fileUploader-${uploadId}`);
    } catch (error) {
      console.error('Error removing state from sessionStorage:', error);
    }
    
    // Notificar o componente pai
    onFileUploaded({
      hasMedia: false,
      mediaFile: null,
      mediaType: '',
      mediaPath: '',
      mediaName: '',
      mediaCaption: ''
    });
    
    // Reset o input file
    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }
  };

  // Handle media file selection
  const handleMediaFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Guardar valores locais para evitar perda de estado durante operações assíncronas
    const localFile = file;
    const localFileName = file.name;
    const localFileType = file.type;
    
    // Atualizar estado imediatamente
    setUploadError(null);
    setMediaFile(localFile);
    setMediaName(localFileName);
    setMediaType(localFileType);
    setHasMedia(true);
    setIsUploading(true);
    
    try {
      // Criar FormData para enviar o arquivo
      const formData = new FormData();
      formData.append('file', localFile);
      
      // Upload do arquivo para o servidor
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Falha ao carregar o arquivo para o servidor');
      }
      
      const data = await response.json();
      console.log("Upload concluído com sucesso:", data);
      
      // Extrair o caminho do arquivo com verificação de diferentes estruturas possíveis
      let filePath = '';
      if (data && data.file && data.file.path) {
        filePath = data.file.path;
      } else if (data && data.path) {
        filePath = data.path;
      }
      
      if (filePath) {
        // Atualizar o estado local
        setMediaPath(filePath);
        setHasMedia(true);
        
        // Notificar o componente pai sobre a atualização
        onFileUploaded({
          hasMedia: true,
          mediaFile: localFile,
          mediaType: localFileType,
          mediaPath: filePath,
          mediaName: localFileName,
          mediaCaption
        });
        
        // Removemos o toast que estava causando o problema
        // Agora usamos apenas o indicador visual no próprio componente
      } else {
        console.error("Formato de resposta inesperado:", data);
        throw new Error('Formato de resposta inesperado');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(error instanceof Error ? error.message : "Erro desconhecido ao anexar arquivo");
      
      // Ao invés de usar toast, que pode causar problemas com o componente pai,
      // apenas definimos o erro que será exibido dentro do próprio componente
      
      // Limpar estado em caso de erro
      clearFileState();
    } finally {
      setIsUploading(false);
      
      // Reset the file input
      if (mediaInputRef.current) {
        mediaInputRef.current.value = '';
      }
    }
  };

  // Atualizar o componente pai quando a legenda for alterada
  const handleCaptionChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newCaption = e.target.value;
    setMediaCaption(newCaption);
    
    // Atualizar o componente pai
    if (hasMedia && mediaFile) {
      onFileUploaded({
        hasMedia,
        mediaFile,
        mediaType,
        mediaPath,
        mediaName,
        mediaCaption: newCaption
      });
    }
  };

  return (
    <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100 media-section">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-[hsl(var(--whatsapp-secondary))]">
          Anexar arquivo
        </label>
        {hasMedia && (
          <button 
            className="text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-full transition-colors"
            onClick={clearFileState}
          >
            Remover arquivo
          </button>
        )}
      </div>
      
      <div className="media-attachment-container min-h-[150px] relative" id={`file-uploader-${uploadId}`}>
        {(hasMedia && mediaFile) ? (
          <div className="border rounded-md p-3 bg-[hsl(var(--whatsapp-light-green))/5] border-[hsl(var(--whatsapp-light-green))/20]">
            <div className="flex items-center">
              <Paperclip className="h-5 w-5 text-[hsl(var(--whatsapp-green))] mr-2 flex-shrink-0" />
              <div className="overflow-hidden flex-1">
                <p className="font-medium text-sm truncate">{mediaName}</p>
                <p className="text-xs text-gray-500">{mediaFile && (mediaFile.size / 1024).toFixed(1)} KB</p>
              </div>
              {isUploading && (
                <Spinner className="ml-auto h-4 w-4 flex-shrink-0" />
              )}
            </div>
            
            {/* Status indicator */}
            {isUploading ? (
              <div className="mt-2 bg-blue-50 text-blue-700 text-xs p-2 rounded flex items-center">
                <Loader className="animate-spin h-3 w-3 mr-2" />
                <span>Enviando arquivo... Aguarde por favor.</span>
              </div>
            ) : mediaPath ? (
              <div className="mt-2 bg-green-50 text-green-700 text-xs p-2 rounded flex items-center">
                <CheckCircle className="h-3 w-3 mr-2" />
                <span>Arquivo anexado com sucesso!</span>
              </div>
            ) : null}
            
            {/* Caption input - only show if upload is complete */}
            {(mediaPath && !isUploading) && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Legenda (opcional)
                </label>
                <Input 
                  type="text"
                  placeholder="Digite uma legenda para o arquivo..."
                  value={mediaCaption}
                  onChange={handleCaptionChange}
                  className="text-sm border-gray-300 focus:border-[hsl(var(--whatsapp-green))] focus:ring focus:ring-[hsl(var(--whatsapp-green))/20]"
                />
              </div>
            )}
          </div>
        ) : (
          /* File selection area */
          <div className="border-2 border-dashed rounded-md p-4 text-center bg-gray-50">
            <input 
              type="file"
              ref={mediaInputRef}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png"
              onChange={handleMediaFileSelect}
            />
            <Button
              variant="outline"
              onClick={() => mediaInputRef.current?.click()}
              className="w-full bg-white hover:bg-gray-50 transition-colors"
              disabled={isUploading}
            >
              <Paperclip className="h-4 w-4 mr-2 text-[hsl(var(--whatsapp-green))]" />
              Selecionar arquivo
            </Button>
            <p className="text-xs text-gray-500 mt-2 italic">
              Tipos permitidos: PDF, Word, Excel, imagens
            </p>
          </div>
        )}
      </div>
      
      {/* Error display */}
      {uploadError && (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao anexar arquivo</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
});

export default FileUploader;