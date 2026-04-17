import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, KeyRound, Mail, Save, Shield, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const MeusDados = () => {
  const navigate = useNavigate();
  const { user, updateLocalUser } = useAuth();
  const isColaborador = user?.role !== 'admin';
  const maskedPassword = useMemo(() => '********', []);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [email, setEmail] = useState(user?.email || '');
  const [passwordView] = useState(maskedPassword);
  const [form, setForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  });

  if (!isColaborador) {
    return (
      <div className="glass rounded-2xl border border-white/10 p-6">
        <h1 className="text-2xl font-bold text-white">Meus dados</h1>
        <p className="mt-2 text-sm text-gray-300">Este modulo esta disponivel apenas para usuarios colaboradores.</p>
      </div>
    );
  }

  const handleSaveEmail = () => {
    const nextEmail = String(email || '').trim().toLowerCase();
    if (!nextEmail || !nextEmail.includes('@')) {
      toast.error('Informe um e-mail valido.');
      return;
    }
    updateLocalUser?.({ email: nextEmail });
    toast.success('E-mail atualizado com sucesso.');
  };

  const handlePasswordChange = (event) => {
    event.preventDefault();
    if (!form.currentPassword || !form.nextPassword || !form.confirmPassword) {
      toast.error('Preencha os tres campos de senha.');
      return;
    }
    if (form.nextPassword.length < 6) {
      toast.error('A nova senha precisa ter ao menos 6 caracteres.');
      return;
    }
    if (form.nextPassword !== form.confirmPassword) {
      toast.error('A confirmacao da senha nao confere.');
      return;
    }
    toast.success('Senha alterada com sucesso (modo local).');
    setForm({ currentPassword: '', nextPassword: '', confirmPassword: '' });
  };

  return (
    <div className="space-y-5">
      <div className="glass-intense rounded-2xl border border-white/10 p-4">
        <h1 className="text-2xl font-bold text-white">Meus dados</h1>
        <p className="mt-1 text-sm text-gray-300">Atualize seu e-mail e altere sua senha de acesso.</p>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 bg-black/25 p-2">
            <UserCircle2 className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Nome</div>
              <div className="text-lg font-semibold text-white">{user?.name || 'Usuario'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Perfil</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                <Shield className="h-3.5 w-3.5" />
                {user?.role || 'colaborador'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-4 sm:p-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 inline-flex items-center gap-2 text-sm font-medium text-gray-200">
            <Mail className="h-4 w-4 text-red-300" />
            E-mail de acesso
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input-futuristic w-full rounded-xl border border-white/10 px-4 py-3 text-base text-white"
            placeholder="usuario@empresa.com"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 inline-flex items-center gap-2 text-sm font-medium text-gray-200">
            <KeyRound className="h-4 w-4 text-red-300" />
            Senha de acesso
          </span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordView}
              readOnly
              className="input-futuristic w-full rounded-xl border border-white/10 px-4 py-3 pr-11 text-base text-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-300 hover:bg-white/10 hover:text-white"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveEmail}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-100 hover:bg-red-500/25"
          >
            <Save className="h-4 w-4" />
            Salvar e-mail
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-100 hover:bg-white/10"
          >
            Voltar para o painel
          </button>
        </div>
      </div>

      <section className="glass rounded-2xl border border-white/10 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Alterar senha</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <PasswordField
            label="Senha atual"
            value={form.currentPassword}
            onChange={(value) => setForm((prev) => ({ ...prev, currentPassword: value }))}
            visible={showCurrent}
            onToggleVisibility={() => setShowCurrent((prev) => !prev)}
          />
          <PasswordField
            label="Nova senha"
            value={form.nextPassword}
            onChange={(value) => setForm((prev) => ({ ...prev, nextPassword: value }))}
            visible={showNext}
            onToggleVisibility={() => setShowNext((prev) => !prev)}
          />
          <PasswordField
            label="Confirmar nova senha"
            value={form.confirmPassword}
            onChange={(value) => setForm((prev) => ({ ...prev, confirmPassword: value }))}
            visible={showConfirm}
            onToggleVisibility={() => setShowConfirm((prev) => !prev)}
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-100 hover:bg-red-500/25"
          >
            <KeyRound className="h-4 w-4" />
            Alterar senha
          </button>
        </form>
      </section>
    </div>
  );
};

const PasswordField = ({ label, value, onChange, visible, onToggleVisibility }) => (
  <label className="block">
    <span className="mb-1.5 inline-flex items-center gap-2 text-sm font-medium text-gray-200">
      <KeyRound className="h-4 w-4 text-red-300" />
      {label}
    </span>
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-futuristic w-full rounded-xl border border-white/10 px-4 py-3 pr-11 text-base text-white"
        placeholder="Digite aqui"
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-300 hover:bg-white/10 hover:text-white"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  </label>
);

export default MeusDados;
