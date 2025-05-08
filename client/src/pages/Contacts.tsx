import React, { useState } from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPhone } from '@/lib/utils';
import { RefreshCw, Search, UserCircle } from 'lucide-react';

const Contacts: React.FC = () => {
  const { contacts, refreshContacts, isConnected } = useWhatsApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatPhone(contact.phoneNumber).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Contatos</h2>
        <Button
          variant="outline" 
          className="flex items-center gap-2"
          onClick={refreshContacts}
          disabled={!isConnected}
        >
          <RefreshCw size={16} />
          <span className="hidden sm:inline">Sincronizar</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            className="pl-10"
            placeholder="Buscar contato por nome ou número"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Contact List */}
      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all">Todos ({contacts.length})</TabsTrigger>
          <TabsTrigger value="favorites">Favoritos (0)</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          {filteredContacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((contact) => (
                <Card key={contact.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                        <UserCircle className="h-6 w-6 text-gray-500" />
                      </div>
                      <div>
                        <h3 className="font-medium">{contact.name}</h3>
                        <p className="text-xs text-[hsl(var(--whatsapp-secondary))]">
                          {formatPhone(contact.phoneNumber)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              {searchTerm ? (
                <>
                  <p className="text-[hsl(var(--whatsapp-secondary))] mb-2">
                    Nenhum contato encontrado para "{searchTerm}"
                  </p>
                  <Button
                    variant="link"
                    onClick={() => setSearchTerm('')}
                    className="text-[hsl(var(--whatsapp-dark-green))]"
                  >
                    Limpar busca
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-[hsl(var(--whatsapp-secondary))] mb-2">
                    Nenhum contato encontrado
                  </p>
                  <Button
                    onClick={refreshContacts}
                    disabled={!isConnected}
                    className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))] text-white"
                  >
                    Sincronizar contatos
                  </Button>
                </>
              )}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="favorites">
          <div className="text-center py-8">
            <p className="text-[hsl(var(--whatsapp-secondary))] mb-2">
              Você ainda não adicionou nenhum contato aos favoritos
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Contacts;
