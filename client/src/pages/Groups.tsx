import React, { useState } from 'react';
import { useWhatsApp } from '@/contexts/WhatsAppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPhone } from '@/lib/utils';
import { RefreshCw, Search, Users } from 'lucide-react';

const Groups: React.FC = () => {
  const { groups, refreshContacts, isConnected } = useWhatsApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Grupos</h2>
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
            placeholder="Buscar grupo por nome"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Group List */}
      {filteredGroups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <Card key={group.id}>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                    <Users className="h-6 w-6 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-medium">{group.name}</h3>
                    <p className="text-xs text-[hsl(var(--whatsapp-secondary))]">
                      {group.memberCount ? `${group.memberCount} membros` : 'Grupo WhatsApp'}
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
                Nenhum grupo encontrado para "{searchTerm}"
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
                Nenhum grupo encontrado
              </p>
              <Button
                onClick={refreshContacts}
                disabled={!isConnected}
                className="bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))] text-white"
              >
                Sincronizar grupos
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Groups;
