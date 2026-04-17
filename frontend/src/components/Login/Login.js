import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import MacedoLogo from '../Brand/MacedoLogo';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      navigate(from, { replace: true });
    }
  };

  const quickLogin = (userEmail, userPassword) => {
    setEmail(userEmail);
    setPassword(userPassword);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-login p-4">
      <div className="absolute inset-0 bg-black/55" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-red-600 opacity-20 blur-xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-red-500 opacity-20 blur-xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex">
            <MacedoLogo size="lg" className="ring-1 ring-white/20 glow-red" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Macedo SI</h1>
          <p className="text-gray-200">Sistema Integrado de Gestão</p>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-futuristic w-full rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-futuristic w-full rounded-xl py-3 pl-10 pr-12 text-white placeholder-gray-400 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-futuristic w-full rounded-xl py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="spinner h-5 w-5 rounded-full border-2 border-white border-t-transparent" />
                  <span>Entrando...</span>
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-gray-700 pt-6">
            <p className="mb-4 text-center text-xs text-gray-400">Acesso rápido para teste:</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => quickLogin('admin@macedosi.com', 'admin123')}
                className="rounded-lg p-2 text-xs text-gray-300 transition-colors hover:bg-black/50 hover:text-red-300"
              >
                👑 Admin: admin@macedosi.com
              </button>
              <button
                onClick={() => quickLogin('colaborador@macedosi.com', 'teste123')}
                className="rounded-lg p-2 text-xs text-gray-300 transition-colors hover:bg-black/50 hover:text-red-300"
              >
                👤 Colaborador: colaborador@macedosi.com
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">© 2026 Macedo SI - Sistema Offline Ready</p>
          <p className="mt-1 text-xs text-gray-500">Sistema Desenvolvido por Isaias Macedo</p>
          <p className="text-xs text-gray-500">Macedo Business Solutions</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
