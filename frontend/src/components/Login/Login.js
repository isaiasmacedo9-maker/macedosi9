import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, Lock, Mail, Eye, EyeOff } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-login p-4 relative">
      {/* Dark overlay for better readability */}
      <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl mb-4 glow-red">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold neon-text mb-2">Macedo SI</h1>
          <p className="text-white">Sistema Integrado de Gestão</p>
        </div>

        {/* Login Form */}
        <div className="glass rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-futuristic w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-futuristic w-full pl-10 pr-12 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-futuristic w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="spinner w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Entrando...</span>
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Quick Login Options */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-400 text-center mb-4">Acesso rápido para teste:</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => quickLogin('admin@macedo.com.br', 'admin123')}
                className="text-xs text-gray-300 hover:text-red-400 p-2 rounded-lg hover:bg-black/50 transition-colors"
              >
                👑 Admin: admin@macedo.com.br
              </button>
              <button
                onClick={() => quickLogin('colaborador@macedo.com.br', 'colab123')}
                className="text-xs text-gray-300 hover:text-red-400 p-2 rounded-lg hover:bg-black/50 transition-colors"
              >
                👤 Colaborador: colaborador@macedo.com.br
              </button>
              <button
                onClick={() => quickLogin('fiscal@macedo.com.br', 'fiscal123')}
                className="text-xs text-gray-300 hover:text-red-400 p-2 rounded-lg hover:bg-black/50 transition-colors"
              >
                📊 Fiscal: fiscal@macedo.com.br
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            © 2025 Macedo SI - Sistema Offline Ready
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Sistema Desenvolvido por Isaias Macedo
          </p>
          <p className="text-xs text-gray-500">
            Macedo Business Solutions
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;