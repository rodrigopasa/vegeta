import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertUserSchema } from '@shared/schema';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Spinner } from '@/components/Spinner';
import { useToast } from '@/hooks/use-toast';

const authSchema = insertUserSchema.extend({
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres")
});

type AuthFormData = z.infer<typeof authSchema>;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const auth = useAuth();
  const user = auth?.user;
  const loginMutation = auth?.loginMutation;
  const registerMutation = auth?.registerMutation;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: '',
      password: ''
    }
  });

  useEffect(() => {
    // Verificar se já existe um usuário cadastrado
    fetch('/api/users/count')
      .then(res => res.json())
      .then(data => {
        setIsFirstUser(data.count === 0);
        // Se já existir usuário, forçar para o modo de login
        if (data.count > 0) {
          setIsLogin(true);
        }
      })
      .catch(err => {
        console.error('Erro ao verificar usuários:', err);
        toast({
          title: 'Erro ao verificar usuários',
          description: 'Não foi possível verificar se existem usuários cadastrados.',
          variant: 'destructive'
        });
      });
  }, []);

  // Redirecionar se o usuário já estiver autenticado
  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);

  const onSubmit = (data: AuthFormData) => {
    if (isLogin) {
      if (loginMutation) {
        loginMutation.mutate({
          username: data.username,
          password: data.password
        });
      } else {
        toast({
          title: "Erro no login",
          description: "Não foi possível iniciar o processo de login",
          variant: "destructive"
        });
      }
    } else {
      if (registerMutation) {
        registerMutation.mutate(data);
      } else {
        toast({
          title: "Erro no registro",
          description: "Não foi possível iniciar o processo de registro",
          variant: "destructive"
        });
      }
    }
  };

  const isPending = loginMutation?.isPending || registerMutation?.isPending || false;

  // Se já estiver logado, não mostrar a página de autenticação
  if (user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--whatsapp-light-green))] to-[hsl(var(--whatsapp-green))]">
      <div className="container flex h-screen items-center justify-center">
        <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
          {/* Formulário à esquerda */}
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="space-y-1">
                <div className="flex justify-center mb-4">
                  <img 
                    src="/pazap-logo.png" 
                    alt="PaZap Logo" 
                    className="h-16 w-auto" 
                    onError={(e) => {
                      // Fallback se a imagem não estiver disponível
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <CardTitle className="text-2xl text-center font-bold">
                  {isLogin ? 'Entrar no PaZap' : 'Criar conta de administrador'}
                </CardTitle>
                <CardDescription className="text-center">
                  {isLogin 
                    ? 'Digite suas credenciais abaixo para entrar'
                    : 'Você será o administrador do sistema'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuário</FormLabel>
                          <FormControl>
                            <Input placeholder="Digite seu nome de usuário" {...field} disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Digite sua senha" 
                              {...field} 
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-dark-green))]"
                      disabled={isPending}
                    >
                      {isPending && <Spinner className="mr-2 h-4 w-4" />}
                      {isLogin ? 'Entrar' : 'Criar conta'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex justify-center">
                {isFirstUser && (
                  <Button 
                    variant="link" 
                    onClick={() => setIsLogin(!isLogin)}
                    disabled={isPending || !isFirstUser}
                  >
                    {isLogin ? 'Criar conta de administrador' : 'Já tenho uma conta'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>

          {/* Hero section à direita */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="space-y-4 text-white">
              <h1 className="text-4xl font-bold tracking-tight">
                PaZap - Disparador de Mensagens
              </h1>
              <p className="text-lg">
                A solução completa para gerenciar e agendar suas mensagens do WhatsApp.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Envie mensagens para contatos individuais ou grupos
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Agende mensagens para envio futuro
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Acompanhe o status de entrega das mensagens
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Visualize contatos e grupos sincronizados
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <footer className="fixed bottom-0 w-full bg-[hsl(var(--whatsapp-dark-green))] text-white p-4 text-center">
        Desenvolvido Por Rodrigo Pasa
      </footer>
    </div>
  );
}