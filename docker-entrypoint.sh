#!/bin/bash
set -e

# Obter o host e a porta do banco de dados a partir da variável DATABASE_URL
# Formato esperado: postgres://username:password@hostname:port/database
if [[ "$DATABASE_URL" =~ ^postgres://.*@([^:]+):([0-9]+)/.*$ ]]; then
  DB_HOST="${BASH_REMATCH[1]}"
  DB_PORT="${BASH_REMATCH[2]}"
else
  # Se não conseguir extrair, usar valores padrão
  DB_HOST="${PGHOST:-localhost}"
  DB_PORT="${PGPORT:-5432}"
fi

echo "Aguardando o banco de dados em $DB_HOST:$DB_PORT..."
wait-for-it $DB_HOST:$DB_PORT -t 60

echo "Banco de dados disponível. Aplicando migrações..."
npm run db:push

echo "Migrações aplicadas. Iniciando a aplicação..."
exec "$@"