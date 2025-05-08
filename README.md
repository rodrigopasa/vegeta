# WhatsApp Scheduler

Sistema de agendamento de mensagens para WhatsApp que permite conectar ao WhatsApp Web, programar mensagens para contatos/grupos e acompanhar o status de entrega.

## Funcionalidades

- Conectar com WhatsApp Web via QR Code
- Sincronizar contatos e grupos do WhatsApp
- Enviar mensagens imediatas para contatos e grupos
- Agendar mensagens para envio futuro
- Editor rico de mensagens com suporte a emojis
- Acompanhar histórico e status de mensagens enviadas
- Armazenamento persistente em PostgreSQL

## Tecnologias

- Frontend: React, TailwindCSS, shadcn/ui
- Backend: Node.js, Express
- Banco de dados: PostgreSQL
- Integração: whatsapp-web.js, Puppeteer

## Deploy no Coolify

Este aplicativo pode ser facilmente implantado usando o Coolify. Siga as etapas abaixo:

### Pré-requisitos

- Uma instância do Coolify configurada
- Um servidor com pelo menos 1GB de RAM e 1 vCPU
- Um repositório Git com o código do aplicativo

### Etapas para deploy

1. **Adicionar novo serviço no Coolify**:
   - No painel do Coolify, clique em "New Service" > "Application"
   - Selecione o repositório Git contendo o código do projeto
   - Escolha "Docker" como tipo de implantação e use o Dockerfile existente

2. **Configurar banco de dados**:
   - No painel do Coolify, adicione um novo serviço de banco de dados PostgreSQL
   - Ou use uma instância PostgreSQL existente

3. **Configurar variáveis de ambiente**:
   - DATABASE_URL: URL de conexão com o banco de dados PostgreSQL
   - NODE_ENV: Definir como "production"
   - PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: Definir como "true"
   - PUPPETEER_EXECUTABLE_PATH: Definir como "/usr/bin/chromium"

4. **Configurações de build e deploy**:
   - Porta de publicação: 5000
   - Verificação de saúde: HTTP na rota /api/whatsapp/status

5. **Deploy**:
   - Inicie o processo de deploy e aguarde a conclusão
   - Após a implantação, acesse a aplicação pela URL fornecida

### Notas importantes

- O aplicativo requer uma instância em execução contínua para lidar com mensagens agendadas
- A conexão com o WhatsApp Web precisa ser refeita se o container for reiniciado
- Você pode configurar backups do banco de dados no Coolify para evitar perda de dados

## Desenvolvimento local

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Executar migrations do banco de dados
npm run db:push

# Construir para produção
npm run build

# Iniciar em modo produção
npm run start
```

## Docker Compose

O projeto inclui um arquivo docker-compose.yml para facilitar o desenvolvimento e testes:

```bash
# Iniciar com Docker Compose
docker-compose up -d

# Parar os containers
docker-compose down
```