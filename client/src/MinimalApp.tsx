import React, { useState, useEffect } from 'react';

function MinimalApp() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar se já existe um usuário cadastrado
  useEffect(() => {
    fetch('/api/users/count')
      .then(res => res.json())
      .then(data => {
        setIsFirstUser(data.count === 0);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Erro ao verificar usuários:', err);
        setError('Não foi possível verificar se existem usuários cadastrados.');
        setIsLoading(false);
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const endpoint = isFirstUser ? '/api/register' : '/api/login';
    
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include' // Importante: isso garante que os cookies sejam enviados/recebidos
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(isFirstUser ? 'Erro ao criar conta' : 'Credenciais inválidas');
        }
        return res.json();
      })
      .then(data => {
        console.log('Sucesso:', data);
        // Recarregar a página após login bem-sucedido
        window.location.href = '/';
      })
      .catch(err => {
        console.error('Erro:', err);
        setError(err.message);
        setIsLoading(false);
      });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <p className="text-center">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-400 to-green-600">
      <div className="p-8 bg-white rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-green-600 mb-6">
          {isFirstUser ? 'Criar Conta de Administrador' : 'Entrar no PaZap'}
        </h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Usuário
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md"
            disabled={isLoading}
          >
            {isFirstUser ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            PaZap - Disparador de Mensagens para WhatsApp
          </p>
        </div>
        
        <footer className="mt-8 text-center text-xs text-gray-500">
          Desenvolvido Por Rodrigo Pasa
        </footer>
      </div>
    </div>
  );
}

export default MinimalApp;