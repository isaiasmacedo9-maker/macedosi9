import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Lock, Save } from 'lucide-react';
import { toast } from 'sonner';

const ChangePassword = () => {
  const navigate = useNavigate();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.currentPassword || !form.nextPassword || !form.confirmPassword) {
      toast.error('Preencha todos os campos de senha.');
      return;
    }
    if (form.nextPassword.length < 6) {
      toast.error('A nova senha precisa ter ao menos 6 caracteres.');
      return;
    }
    if (form.nextPassword !== form.confirmPassword) {
      toast.error('A confirmação da senha não confere.');
      return;
    }

    toast.success('Senha atualizada com sucesso (modo mock).');
    setForm({ currentPassword: '', nextPassword: '', confirmPassword: '' });
  };

  return (
    <div className="space-y-5">
      <section className="glass-intense rounded-2xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Alterar senha</h1>
            <p className="mt-1 text-sm text-gray-300">Atualize sua senha de acesso ao painel interno.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/configuracoes')}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10"
          >
            Voltar para Configurações
          </button>
        </div>
      </section>

      <section className="glass rounded-2xl border border-white/10 p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label="Senha atual"
            value={form.currentPassword}
            onChange={(value) => handleChange('currentPassword', value)}
            visible={showCurrent}
            onToggleVisibility={() => setShowCurrent((prev) => !prev)}
          />
          <PasswordField
            label="Nova senha"
            value={form.nextPassword}
            onChange={(value) => handleChange('nextPassword', value)}
            visible={showNext}
            onToggleVisibility={() => setShowNext((prev) => !prev)}
          />
          <PasswordField
            label="Confirmar nova senha"
            value={form.confirmPassword}
            onChange={(value) => handleChange('confirmPassword', value)}
            visible={showConfirm}
            onToggleVisibility={() => setShowConfirm((prev) => !prev)}
          />

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-100 hover:bg-red-500/25"
          >
            <Save className="h-4 w-4" />
            Salvar nova senha
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
        className="input-futuristic w-full rounded-xl border border-white/10 py-3 pl-11 pr-11 text-base text-white"
        placeholder="Digite aqui"
      />
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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

export default ChangePassword;
