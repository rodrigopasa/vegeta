FROM node:20-slim

WORKDIR /app

# Instala dependências do sistema para o Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    fonts-ipafont-gothic \
    fonts-kacst \
    fonts-thai-tlwg \
    procps \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar o resto dos arquivos
COPY . .

# Configurar variáveis de ambiente para o Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV USE_SIMULATED_CLIENT=true

# Instalar utilitário wait-for-it para aguardar disponibilidade do banco
RUN apt-get update && apt-get install -y --no-install-recommends \
    wait-for-it \
    && rm -rf /var/lib/apt/lists/*

# Criar script de inicialização para garantir que as migrações sejam aplicadas antes de iniciar o servidor
COPY ./docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

# Construir a aplicação para produção
RUN npm run build

# Expor a porta 5000
EXPOSE 5000

# Configurar ambiente de produção
ENV NODE_ENV=production

# Usar o script de entrada para garantir que o banco esteja pronto e migrações aplicadas antes de iniciar
ENTRYPOINT ["/docker-entrypoint.sh"]

# Iniciar o servidor em modo de produção
CMD ["npm", "run", "start"]