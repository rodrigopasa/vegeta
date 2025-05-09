import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUp, Upload, FileQuestion, Check, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';

interface CSVImporterProps {
  onComplete: (contacts: ContactImport[]) => void;
}

type ContactImport = {
  name: string;
  phoneNumber: string;
  isValid: boolean;
};

const CSVImporter: React.FC<CSVImporterProps> = ({ onComplete }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ContactImport[]>([]);
  const [nameColumn, setNameColumn] = useState<string>('');
  const [phoneColumn, setPhoneColumn] = useState<string>('');
  const [columns, setColumns] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'confirm'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const resetState = () => {
    setFile(null);
    setContacts([]);
    setNameColumn('');
    setPhoneColumn('');
    setColumns([]);
    setPreviewData([]);
    setStep('upload');
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Validar se é um arquivo CSV
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo CSV válido.",
        variant: "destructive"
      });
      return;
    }
    
    // Iniciar processamento do arquivo
    processCSV(selectedFile);
  };
  
  const processCSV = (csvFile: File) => {
    setIsProcessing(true);
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string;
        
        // Dividir o CSV em linhas
        const lines = csv.split(/\\r?\\n/).filter(line => line.trim().length > 0);
        
        if (lines.length === 0) {
          throw new Error("Arquivo CSV vazio");
        }
        
        // Se existir BOM (Byte Order Mark) no inicio do arquivo, remover
        let headerLine = lines[0];
        if (headerLine.startsWith('\\ufeff')) {
          headerLine = headerLine.substring(1);
          lines[0] = headerLine;
        }
        
        // Detectar o delimitador (vírgula, ponto e vírgula, tab)
        const delimiter = detectDelimiter(headerLine);
        
        // Extrair cabeçalhos (nomes das colunas)
        const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
        
        // Criar preview dos dados
        const preview: string[][] = [];
        for (let i = 0; i < Math.min(5, lines.length); i++) {
          const rowData = lines[i].split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
          preview.push(rowData);
        }
        
        setColumns(headers);
        setPreviewData(preview);
        setIsProcessing(false);
        setStep('map');
        
      } catch (error) {
        setIsProcessing(false);
        console.error("Erro ao processar CSV:", error);
        toast({
          title: "Erro ao processar arquivo",
          description: "Não foi possível ler o arquivo CSV. Verifique se o formato está correto.",
          variant: "destructive"
        });
      }
    };
    
    reader.onerror = () => {
      setIsProcessing(false);
      toast({
        title: "Erro ao ler arquivo",
        description: "Ocorreu um erro ao tentar ler o arquivo.",
        variant: "destructive"
      });
    };
    
    reader.readAsText(csvFile);
  };
  
  const detectDelimiter = (headerLine: string): string => {
    const delimiters = [',', ';', '\\t'];
    let bestDelimiter = ',';
    let maxCount = 0;
    
    for (const delimiter of delimiters) {
      const count = (headerLine.match(new RegExp(delimiter, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    }
    
    return bestDelimiter;
  };
  
  const validateAndMapContacts = () => {
    if (!nameColumn || !phoneColumn) {
      toast({
        title: "Seleção de colunas necessária",
        description: "Você precisa selecionar as colunas de nome e número de telefone.",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const csv = event.target?.result as string;
          
          // Dividir o CSV em linhas
          const lines = csv.split(/\\r?\\n/).filter(line => line.trim().length > 0);
          
          // Detectar o delimitador
          const delimiter = detectDelimiter(lines[0]);
          
          // Extrair cabeçalhos
          let headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
          
          // Se existir BOM (Byte Order Mark) no inicio do arquivo, remover
          if (headers[0].startsWith('\\ufeff')) {
            headers[0] = headers[0].substring(1);
          }
          
          // Encontrar índices das colunas selecionadas
          const nameIndex = headers.indexOf(nameColumn);
          const phoneIndex = headers.indexOf(phoneColumn);
          
          if (nameIndex === -1 || phoneIndex === -1) {
            throw new Error("Colunas selecionadas não encontradas");
          }
          
          // Extrair e validar contatos
          const mappedContacts: ContactImport[] = [];
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            
            if (!line.trim()) continue;
            
            const values = line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
            
            if (values.length <= Math.max(nameIndex, phoneIndex)) {
              console.warn(`Linha ${i+1} inválida, possui menos colunas que o esperado`);
              continue;
            }
            
            const name = values[nameIndex];
            let phoneNumber = values[phoneIndex];
            
            // Validar e formatar número de telefone
            phoneNumber = phoneNumber.replace(/\\D/g, '');
            
            // Verificar se já tem código do país, senão adiciona 55 (Brasil)
            if (phoneNumber.length <= 12 && !phoneNumber.startsWith('55')) {
              phoneNumber = '55' + phoneNumber;
            }
            
            // Verificar se o número é válido (pelo menos 10 dígitos após o código do país)
            const isValid = phoneNumber.length >= 12;
            
            mappedContacts.push({
              name,
              phoneNumber,
              isValid
            });
          }
          
          setContacts(mappedContacts);
          setIsProcessing(false);
          setStep('preview');
          
        } catch (error) {
          setIsProcessing(false);
          console.error("Erro ao mapear contatos:", error);
          toast({
            title: "Erro ao processar contatos",
            description: "Não foi possível extrair os contatos do arquivo CSV.",
            variant: "destructive"
          });
        }
      };
      
      reader.onerror = () => {
        setIsProcessing(false);
        toast({
          title: "Erro ao ler arquivo",
          description: "Ocorreu um erro ao tentar ler o arquivo.",
          variant: "destructive"
        });
      };
      
      reader.readAsText(file as Blob);
      
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Erro ao processar arquivo",
        description: "Ocorreu um erro ao processar o arquivo.",
        variant: "destructive"
      });
    }
  };
  
  const handleConfirm = () => {
    // Filtrar apenas contatos válidos
    const validContacts = contacts.filter(contact => contact.isValid);
    
    if (validContacts.length === 0) {
      toast({
        title: "Nenhum contato válido",
        description: "Nenhum dos contatos importados possui um número de telefone válido.",
        variant: "destructive"
      });
      return;
    }
    
    // Chamar a função de callback com os contatos importados
    onComplete(validContacts);
    
    // Resetar o estado e fechar o modal
    toast({
      title: "Importação concluída",
      description: `${validContacts.length} contato(s) importado(s) com sucesso.`,
    });
    
    resetState();
    setOpen(false);
  };
  
  const renderStep = () => {
    switch (step) {
      case 'upload':
        return (
          <div className="space-y-6 py-6">
            <div className="border-dashed border-2 border-gray-300 rounded-lg p-12 text-center">
              <FileUp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Arrastar e soltar arquivo CSV</h3>
              <p className="text-sm text-gray-500 mb-4">ou</p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                id="csv-file"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processando...' : 'Selecionar arquivo'}
              </Button>
              <p className="mt-4 text-xs text-gray-500">
                O arquivo deve estar no formato CSV com colunas para nome e número de telefone
              </p>
            </div>
          </div>
        );
        
      case 'map':
        return (
          <div className="space-y-6 py-6">
            <h3 className="text-lg font-medium mb-4">Mapear colunas</h3>
            
            {previewData.length > 0 && (
              <div className="border rounded-md overflow-x-auto mb-6">
                <Table>
                  <TableCaption>Prévia dos dados</TableCaption>
                  <TableHeader>
                    <TableRow>
                      {previewData[0].map((header, index) => (
                        <TableHead key={index}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(1).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name-column">Coluna de Nome</Label>
                <Select value={nameColumn} onValueChange={setNameColumn}>
                  <SelectTrigger id="name-column">
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column, index) => (
                      <SelectItem key={index} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone-column">Coluna de Telefone</Label>
                <Select value={phoneColumn} onValueChange={setPhoneColumn}>
                  <SelectTrigger id="phone-column">
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column, index) => (
                      <SelectItem key={index} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800">Selecione as colunas corretamente</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Certifique-se de selecionar a coluna correta para o nome e telefone dos contatos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'preview':
        const validCount = contacts.filter(c => c.isValid).length;
        const invalidCount = contacts.length - validCount;
        
        return (
          <div className="space-y-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Prévia dos contatos</h3>
              <div className="text-sm text-gray-500">
                Total: <span className="font-semibold">{contacts.length}</span> | 
                Válidos: <span className="font-semibold text-green-600">{validCount}</span> | 
                Inválidos: <span className="font-semibold text-red-600">{invalidCount}</span>
              </div>
            </div>
            
            {invalidCount > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                <div className="flex">
                  <AlertCircle className="h-4 w-4 text-yellow-400 mr-2" />
                  <p className="text-sm text-yellow-700">
                    {invalidCount} número(s) de telefone inválido(s) foram encontrados. Estes contatos não serão importados.
                  </p>
                </div>
              </div>
            )}
            
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.slice(0, 100).map((contact, index) => (
                    <TableRow key={index}>
                      <TableCell>{contact.name}</TableCell>
                      <TableCell>{contact.phoneNumber}</TableCell>
                      <TableCell>
                        {contact.isValid ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" /> Válido
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="h-3 w-3 mr-1" /> Inválido
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {contacts.length > 100 && (
                <div className="p-2 text-center text-sm text-gray-500">
                  Mostrando 100 de {contacts.length} contatos
                </div>
              )}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  const renderFooter = () => {
    switch (step) {
      case 'upload':
        return (
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        );
        
      case 'map':
        return (
          <>
            <Button variant="ghost" onClick={() => setStep('upload')}>
              Voltar
            </Button>
            <Button 
              onClick={validateAndMapContacts} 
              disabled={!nameColumn || !phoneColumn || isProcessing}
            >
              {isProcessing ? 'Processando...' : 'Continuar'}
            </Button>
          </>
        );
        
      case 'preview':
        return (
          <>
            <Button variant="ghost" onClick={() => setStep('map')}>
              Voltar
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={contacts.filter(c => c.isValid).length === 0}
            >
              Importar Contatos
            </Button>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        resetState();
      }
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> 
          Importar Contatos CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Importar Contatos de CSV</DialogTitle>
          <DialogDescription>
            Importe contatos de um arquivo CSV para envio em massa de mensagens.
          </DialogDescription>
        </DialogHeader>
        
        {renderStep()}
        
        <DialogFooter>
          {renderFooter()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVImporter;