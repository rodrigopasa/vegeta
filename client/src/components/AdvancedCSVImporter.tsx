import React, { useState, useRef, useCallback } from 'react';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  Switch
} from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { FileUp, Upload, FileQuestion, Check, AlertCircle, Database, ClipboardCheck, Trash, Users, FileCog, UserCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';

interface CSVImporterProps {
  onComplete: (contacts: ContactImport[]) => void;
}

type ContactImport = {
  name: string;
  phoneNumber: string;
  isValid: boolean;
  group?: string; // Opcional: grupo para organização
  notes?: string; // Opcional: notas adicionais
};

type MappedColumns = {
  [key: string]: string; // campo -> coluna do CSV
};

type PhoneFormat = 'auto' | 'international' | 'brazilian';

const AdvancedCSVImporter: React.FC<CSVImporterProps> = ({ onComplete }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ContactImport[]>([]);
  const [mappedColumns, setMappedColumns] = useState<MappedColumns>({});
  const [columns, setColumns] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'confirm'>('upload');
  const [duplicatesFound, setDuplicatesFound] = useState<number>(0);
  const [invalidFound, setInvalidFound] = useState<number>(0);
  const [phoneFormat, setPhoneFormat] = useState<PhoneFormat>('auto');
  const [removeBrazilianPrefix, setRemoveBrazilianPrefix] = useState<boolean>(true);
  const [removeDuplicates, setRemoveDuplicates] = useState<boolean>(true);
  const [addCountryCode, setAddCountryCode] = useState<boolean>(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  const dropAreaRef = useRef<HTMLDivElement>(null);

  const resetState = () => {
    setFile(null);
    setContacts([]);
    setMappedColumns({});
    setColumns([]);
    setPreviewData([]);
    setStep('upload');
    setIsProcessing(false);
    setDuplicatesFound(0);
    setInvalidFound(0);
    setPhoneFormat('auto');
    setRemoveBrazilianPrefix(true);
    setRemoveDuplicates(true);
    setAddCountryCode(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.add('border-[hsl(var(--primary))]', 'bg-[hsl(var(--primary))]/5');
    }
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('border-[hsl(var(--primary))]', 'bg-[hsl(var(--primary))]/5');
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('border-[hsl(var(--primary))]', 'bg-[hsl(var(--primary))]/5');
    }
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const file = droppedFiles[0];
      
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setFile(file);
        processCSV(file);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione um arquivo CSV válido.",
          variant: "destructive"
        });
      }
    }
  }, []);
  
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
        const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        if (lines.length === 0) {
          throw new Error("Arquivo CSV vazio");
        }
        
        // Se existir BOM (Byte Order Mark) no inicio do arquivo, remover
        let headerLine = lines[0];
        if (headerLine.startsWith('\ufeff')) {
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
        
        // Tentar fazer auto-mapeamento das colunas comuns
        const autoMappedColumns: MappedColumns = {};
        
        // Procurar colunas de nome
        const nameColumnKeywords = ['nome', 'name', 'contato', 'cliente', 'customer', 'contact'];
        for (const col of headers) {
          if (nameColumnKeywords.some(keyword => col.toLowerCase().includes(keyword))) {
            autoMappedColumns['name'] = col;
            break;
          }
        }
        
        // Procurar colunas de telefone
        const phoneColumnKeywords = ['fone', 'phone', 'celular', 'mobile', 'tel', 'telefone', 'whatsapp', 'contato', 'numero'];
        for (const col of headers) {
          if (phoneColumnKeywords.some(keyword => col.toLowerCase().includes(keyword))) {
            autoMappedColumns['phoneNumber'] = col;
            break;
          }
        }
        
        // Procurar colunas de grupo
        const groupColumnKeywords = ['grupo', 'group', 'categoria', 'category', 'tipo', 'type', 'segmento', 'segment'];
        for (const col of headers) {
          if (groupColumnKeywords.some(keyword => col.toLowerCase().includes(keyword))) {
            autoMappedColumns['group'] = col;
            break;
          }
        }
        
        // Procurar colunas de notas
        const notesColumnKeywords = ['nota', 'note', 'observacao', 'obs', 'comentario', 'comment'];
        for (const col of headers) {
          if (notesColumnKeywords.some(keyword => col.toLowerCase().includes(keyword))) {
            autoMappedColumns['notes'] = col;
            break;
          }
        }
        
        setColumns(headers);
        setPreviewData(preview);
        setMappedColumns(autoMappedColumns);
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
    const delimiters = [',', ';', '\t'];
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
  
  // Função para normalizar números de telefone brasileiros, removendo o 9 extra se necessário
  const normalizeBrazilianPhoneNumber = (number: string): string => {
    // Se já começar com 55, vamos verificar o formato
    if (number.startsWith('55')) {
      // Se for o formato 55 + DDD (2 dígitos) + 9 + 8 dígitos = total 13 dígitos
      if (number.length === 13) {
        // Verificamos se o número tem o 9 extra após o DDD
        const ddd = number.substring(2, 4);
        const restOfNumber = number.substring(4);
        
        // Se começar com 9 e o formato for brasileiro com o DDD, remover o 9
        if (restOfNumber.startsWith('9') && removeBrazilianPrefix) {
          return `55${ddd}${restOfNumber.substring(1)}`;
        }
      }
    } 
    // Se for um número brasileiro sem o código do país
    else if (number.length === 11 && number.startsWith('9') && removeBrazilianPrefix) {
      // Formato 9 + 8 dígitos = 9 dígitos sem código país e sem DDD
      return number.substring(1);
    }
    // DDD + 9 (adicional) + número (sem código país)
    else if (number.length === 11) {
      // Formato DDD (2 dígitos) + 9 + 8 dígitos = 11 dígitos sem código país
      const ddd = number.substring(0, 2);
      const restOfNumber = number.substring(2);
      
      // Se começar com 9 e o formato for brasileiro sem o código país, remover o 9
      if (restOfNumber.startsWith('9') && removeBrazilianPrefix) {
        const finalNumber = ddd + restOfNumber.substring(1);
        
        if (addCountryCode) {
          return `55${finalNumber}`;
        } else {
          return finalNumber;
        }
      } else if (addCountryCode) {
        return `55${number}`;
      }
    }
    // Adicionar código país se for número sem ele
    else if (number.length === 10 && addCountryCode) {
      // Supomos que seja DDD + número sem o 9 adicional
      return `55${number}`;
    }
    // Adicionar código país para outros formatos de número
    else if (addCountryCode && !number.startsWith('55')) {
      return `55${number}`;
    }
    
    return number;
  };
  
  const validateAndMapContacts = () => {
    if (!mappedColumns.name || !mappedColumns.phoneNumber) {
      toast({
        title: "Seleção de colunas necessária",
        description: "Você precisa mapear as colunas de nome e número de telefone.",
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
          const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
          
          // Detectar o delimitador
          const delimiter = detectDelimiter(lines[0]);
          
          // Extrair cabeçalhos
          let headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
          
          // Se existir BOM (Byte Order Mark) no inicio do arquivo, remover
          if (headers[0].startsWith('\ufeff')) {
            headers[0] = headers[0].substring(1);
          }
          
          // Encontrar índices das colunas mapeadas
          const nameIndex = headers.indexOf(mappedColumns.name);
          const phoneIndex = headers.indexOf(mappedColumns.phoneNumber);
          const groupIndex = mappedColumns.group ? headers.indexOf(mappedColumns.group) : -1;
          const notesIndex = mappedColumns.notes ? headers.indexOf(mappedColumns.notes) : -1;
          
          if (nameIndex === -1 || phoneIndex === -1) {
            throw new Error("Colunas mapeadas não encontradas");
          }
          
          // Extrair e validar contatos
          const mappedContacts: ContactImport[] = [];
          
          // Set para detectar duplicatas por número de telefone
          const uniquePhoneNumbers = new Set<string>();
          let duplicatesCount = 0;
          let invalidCount = 0;
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            
            if (!line.trim()) continue;
            
            const values = line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
            
            if (values.length <= Math.max(nameIndex, phoneIndex)) {
              console.warn(`Linha ${i+1} inválida, possui menos colunas que o esperado`);
              continue;
            }
            
            const name = values[nameIndex] || 'Sem nome';
            let phoneNumber = values[phoneIndex] || '';
            const group = groupIndex >= 0 ? values[groupIndex] : undefined;
            const notes = notesIndex >= 0 ? values[notesIndex] : undefined;
            
            // Se estiver vazio, marcar como inválido e continuar
            if (!phoneNumber) {
              invalidCount++;
              mappedContacts.push({
                name,
                phoneNumber: '',
                isValid: false,
                group,
                notes
              });
              continue;
            }
            
            // Validar e formatar número de telefone
            phoneNumber = phoneNumber.replace(/\D/g, '');
            
            // Validação e formatação conforme o formato selecionado
            if (phoneFormat === 'auto' || phoneFormat === 'brazilian') {
              phoneNumber = normalizeBrazilianPhoneNumber(phoneNumber);
            } else if (phoneFormat === 'international') {
              // Garante que tenha o código do país
              if (!phoneNumber.startsWith('55') && addCountryCode) {
                phoneNumber = '55' + phoneNumber;
              }
            }
            
            // Verificar se o número é válido (pelo menos 10 dígitos, com ou sem código país)
            const isValid = phoneNumber.length >= 10;
            
            if (!isValid) {
              invalidCount++;
            }
            
            // Verificar se é uma duplicata e se devemos ignorar
            if (uniquePhoneNumbers.has(phoneNumber) && removeDuplicates) {
              duplicatesCount++;
              continue;
            }
            
            // Adicionar à lista de números únicos
            uniquePhoneNumbers.add(phoneNumber);
            
            mappedContacts.push({
              name,
              phoneNumber,
              isValid,
              group,
              notes
            });
          }
          
          setDuplicatesFound(duplicatesCount);
          setInvalidFound(invalidCount);
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
    
    // Feedback sobre a importação
    toast({
      title: "Importação concluída",
      description: `${validContacts.length} contato(s) importado(s) com sucesso.`,
    });
    
    // Resetar o estado e fechar o modal
    resetState();
    setOpen(false);
  };
  
  const renderStep = () => {
    switch (step) {
      case 'upload':
        return (
          <div className="space-y-6 py-4">
            <div 
              ref={dropAreaRef}
              className="border-dashed border-2 border-gray-300 rounded-lg p-12 text-center transition-colors duration-300"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileUp className="h-12 w-12 mx-auto text-[hsl(var(--primary))] mb-4" />
              <h3 className="text-lg font-medium mb-2">Arrastar e soltar arquivo CSV</h3>
              <p className="text-sm text-[hsl(var(--text-light))] mb-4">ou</p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                id="csv-file"
              />
              <Button 
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processando...' : 'Selecionar arquivo'}
              </Button>
              <p className="mt-6 text-xs text-[hsl(var(--text-light))]">
                O arquivo deve estar no formato CSV com colunas para nome e número de telefone
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <FileCog className="h-4 w-4 mr-2 text-[hsl(var(--primary))]" />
                    Formatos suportados
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-[hsl(var(--text-light))]">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Arquivos .CSV (valores separados por vírgula)</li>
                    <li>Suporta delimitadores: vírgula, ponto-e-vírgula, tab</li>
                    <li>UTF-8 e outros encodings comuns</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <UserCheck className="h-4 w-4 mr-2 text-[hsl(var(--primary))]" />
                    Tratamento de dados
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-[hsl(var(--text-light))]">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Validação automática de números</li>
                    <li>Formatação para o padrão WhatsApp</li>
                    <li>Remoção de duplicatas</li>
                    <li>Detecção e correção de prefixos</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <ClipboardCheck className="h-4 w-4 mr-2 text-[hsl(var(--primary))]" />
                    Dicas de preparação
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-[hsl(var(--text-light))]">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Use cabeçalhos descritivos nas colunas</li>
                    <li>Garanta que números tenham DDD</li>
                    <li>Adicione colunas para agrupar contatos</li>
                    <li>Evite caracteres especiais</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        );
        
      case 'map':
        return (
          <div className="space-y-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-lg font-medium">Mapear colunas</h3>
                <p className="text-sm text-[hsl(var(--text-light))]">
                  Associe as colunas do seu arquivo às informações necessárias
                </p>
              </div>
              
              <div className="flex items-center text-sm text-[hsl(var(--primary-dark))]">
                <Database className="h-4 w-4 mr-1.5" />
                <span>{file?.name || "arquivo.csv"}</span>
              </div>
            </div>
            
            {previewData.length > 0 && (
              <Card className="shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Prévia dos dados</CardTitle>
                  <CardDescription className="text-xs">
                    Verificando primeiras {previewData.length-1} linhas de {file?.name}
                  </CardDescription>
                </CardHeader>
                <div className="max-h-[250px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewData[0].map((header, index) => (
                          <TableHead key={index} className="text-xs">{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.slice(1).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex} className="py-2 text-xs">{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
            
            <Tabs defaultValue="mapping" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="mapping">Mapeamento de Colunas</TabsTrigger>
                <TabsTrigger value="options">Opções de Formatação</TabsTrigger>
              </TabsList>
              
              <TabsContent value="mapping" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Selecione as colunas correspondentes
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Mapeie as colunas do seu CSV para os campos necessários
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name-column" className="flex items-center text-xs font-semibold">
                          <span className="text-[hsl(var(--error))]">*</span> 
                          Nome do contato
                        </Label>
                        <Select 
                          value={mappedColumns.name} 
                          onValueChange={(value) => setMappedColumns({...mappedColumns, name: value})}
                        >
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
                        <Label htmlFor="phone-column" className="flex items-center text-xs font-semibold">
                          <span className="text-[hsl(var(--error))]">*</span> 
                          Número de telefone
                        </Label>
                        <Select 
                          value={mappedColumns.phoneNumber} 
                          onValueChange={(value) => setMappedColumns({...mappedColumns, phoneNumber: value})}
                        >
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
                      
                      <div className="space-y-2">
                        <Label htmlFor="group-column" className="flex items-center text-xs font-semibold">
                          <span className="text-[hsl(var(--text-light))]">(Opcional)</span> 
                          Grupo/Categoria
                        </Label>
                        <Select 
                          value={mappedColumns.group} 
                          onValueChange={(value) => setMappedColumns({...mappedColumns, group: value})}
                        >
                          <SelectTrigger id="group-column">
                            <SelectValue placeholder="Selecione a coluna" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nenhuma</SelectItem>
                            {columns.map((column, index) => (
                              <SelectItem key={index} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="notes-column" className="flex items-center text-xs font-semibold">
                          <span className="text-[hsl(var(--text-light))]">(Opcional)</span> 
                          Observações/Notas
                        </Label>
                        <Select 
                          value={mappedColumns.notes} 
                          onValueChange={(value) => setMappedColumns({...mappedColumns, notes: value})}
                        >
                          <SelectTrigger id="notes-column">
                            <SelectValue placeholder="Selecione a coluna" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nenhuma</SelectItem>
                            {columns.map((column, index) => (
                              <SelectItem key={index} value={column}>
                                {column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="options" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Opções de tratamento de números
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Configure como os números de telefone serão processados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Formato do telefone</Label>
                          <p className="text-xs text-[hsl(var(--text-light))]">
                            Selecione como os números serão formatados
                          </p>
                        </div>
                        <Select 
                          value={phoneFormat} 
                          onValueChange={(value) => setPhoneFormat(value as PhoneFormat)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Selecione o formato" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto-detectar</SelectItem>
                            <SelectItem value="brazilian">Brasileiro (DDD+Número)</SelectItem>
                            <SelectItem value="international">Internacional</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-t">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Remover o 9 adicional brasileiro</Label>
                          <p className="text-xs text-[hsl(var(--text-light))]">
                            Remove o 9 extra nos números de celular do Brasil
                          </p>
                        </div>
                        <Switch
                          checked={removeBrazilianPrefix}
                          onCheckedChange={setRemoveBrazilianPrefix}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-t">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Adicionar código do país (55)</Label>
                          <p className="text-xs text-[hsl(var(--text-light))]">
                            Adiciona o código 55 (Brasil) quando ausente
                          </p>
                        </div>
                        <Switch
                          checked={addCountryCode}
                          onCheckedChange={setAddCountryCode}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-t">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Remover contatos duplicados</Label>
                          <p className="text-xs text-[hsl(var(--text-light))]">
                            Ignorar números de telefone repetidos
                          </p>
                        </div>
                        <Switch
                          checked={removeDuplicates}
                          onCheckedChange={setRemoveDuplicates}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            
            <div className="p-3 bg-[hsl(var(--warning-light))] rounded-md mt-2">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-[hsl(var(--warning))] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--warning))]">Importante</p>
                  <p className="text-xs text-[hsl(var(--text-dark))] mt-1">
                    Selecione corretamente as colunas que contêm os nomes e números de telefone.
                    Números inválidos ou incorretamente formatados não serão importados.
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
          <div className="space-y-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <h3 className="text-lg font-medium">Prévia dos contatos</h3>
              
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full">
                  <Users className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                  <span className="font-normal text-xs mr-1">Total:</span>
                  <span className="font-semibold">{contacts.length}</span>
                </Badge>
                
                <Badge variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success))]">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-normal text-xs mr-1">Válidos:</span>
                  <span className="font-semibold">{validCount}</span>
                </Badge>
                
                {invalidCount > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full bg-[hsl(var(--error-light))] text-[hsl(var(--error))] border-[hsl(var(--error))]">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="font-normal text-xs mr-1">Inválidos:</span>
                    <span className="font-semibold">{invalidCount}</span>
                  </Badge>
                )}
                
                {duplicatesFound > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border-amber-200">
                    <Trash className="h-3.5 w-3.5" />
                    <span className="font-normal text-xs mr-1">Duplicados removidos:</span>
                    <span className="font-semibold">{duplicatesFound}</span>
                  </Badge>
                )}
              </div>
            </div>
            
            {invalidCount > 0 && (
              <Card className="bg-[hsl(var(--error-light))] border-[hsl(var(--error))]">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-[hsl(var(--error))]" />
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--error))]">
                        {invalidCount} número(s) de telefone inválido(s)
                      </p>
                      <p className="text-xs text-[hsl(var(--text-dark))] mt-1">
                        Foram encontrados contatos com números de telefone inválidos. Estes contatos não serão importados.
                        Verifique se os números têm o formato correto, incluindo código do país e DDD.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {duplicatesFound > 0 && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-700">
                        {duplicatesFound} contato(s) duplicado(s) removido(s)
                      </p>
                      <p className="text-xs text-[hsl(var(--text-dark))] mt-1">
                        Encontramos e removemos números de telefone duplicados. Para cada número, 
                        apenas o primeiro contato encontrado foi mantido.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Contatos a serem importados</CardTitle>
                <CardDescription className="text-xs">
                  {validCount} contatos serão adicionados à sua lista
                </CardDescription>
              </CardHeader>
              <div className="max-h-[350px] overflow-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[40%]">Nome</TableHead>
                      <TableHead className="text-xs w-[35%]">Número</TableHead>
                      {mappedColumns.group && (
                        <TableHead className="text-xs">Grupo</TableHead>
                      )}
                      <TableHead className="text-xs w-[10%]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.slice(0, 100).map((contact, index) => (
                      <TableRow key={index} className={!contact.isValid ? "opacity-50" : ""}>
                        <TableCell className="py-2.5 text-xs font-medium">
                          {contact.name}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs font-mono">
                          {contact.phoneNumber ? contact.phoneNumber : 
                            <span className="text-[hsl(var(--text-light))] italic">vazio</span>
                          }
                        </TableCell>
                        {mappedColumns.group && (
                          <TableCell className="py-2.5 text-xs">
                            {contact.group || <span className="text-[hsl(var(--text-light))] italic">-</span>}
                          </TableCell>
                        )}
                        <TableCell className="py-2.5">
                          {contact.isValid ? (
                            <Badge className="badge-success">
                              <Check className="h-3 w-3 mr-1" /> Válido
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" /> Inválido
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {contacts.length > 100 && (
                <CardFooter className="border-t px-6 py-3">
                  <p className="text-xs text-[hsl(var(--text-light))]">
                    Mostrando 100 de {contacts.length} contatos
                  </p>
                </CardFooter>
              )}
            </Card>
          </div>
        );
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={() => resetState()}>
          <Upload className="h-4 w-4 mr-2" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Importar contatos do CSV</DialogTitle>
          <DialogDescription>
            Importe contatos de um arquivo CSV para enviar mensagens em massa.
          </DialogDescription>
        </DialogHeader>
        
        {renderStep()}
        
        <DialogFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => {
              if (step === 'map') {
                setStep('upload');
              } else if (step === 'preview') {
                setStep('map');
              }
            }}
            disabled={step === 'upload' || isProcessing}
          >
            Voltar
          </Button>
          
          <div>
            <Button 
              variant="ghost" 
              onClick={() => {
                resetState();
                setOpen(false);
              }}
              className="mr-2"
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            
            <Button 
              className="btn btn-primary"
              onClick={() => {
                if (step === 'map') {
                  validateAndMapContacts();
                } else if (step === 'preview') {
                  handleConfirm();
                }
              }}
              disabled={isProcessing || (step === 'map' && (!mappedColumns.name || !mappedColumns.phoneNumber))}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                  <span>Processando...</span>
                </div>
              ) : step === 'upload' ? (
                <>Avançar</>
              ) : step === 'map' ? (
                <>Processar contatos</>
              ) : (
                <>Importar {contacts.filter(c => c.isValid).length} contato(s)</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedCSVImporter;