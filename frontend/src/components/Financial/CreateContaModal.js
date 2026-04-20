import React, { useState } from 'react';
import { X, Building, FileText, DollarSign, Calendar, MapPin, User } from 'lucide-react';

const CreateContaModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    empresa_id: '',
    empresa: '',
    descricao: '',
    documento: '',
    tipo_documento: 'boleto',
    forma_pagamento: 'boleto',
    conta: '',
    centro_custo: '',
    plano_custo: '',
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    valor_original: '',
    observacao: '',
    cidade_atendimento: '',
    usuario_responsavel: '',
    gerar_mais_meses: '0',
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        valor_original: parseFloat(formData.valor_original)
      });
      setFormData({
        empresa_id: '',
        empresa: '',
        descricao: '',
        documento: '',
        tipo_documento: 'boleto',
        forma_pagamento: 'boleto',
        conta: '',
        centro_custo: '',
        plano_custo: '',
        data_emissao: new Date().toISOString().split('T')[0],
        data_vencimento: '',
        valor_original: '',
        observacao: '',
        cidade_atendimento: '',
        usuario_responsavel: '',
        gerar_mais_meses: '0',
      });
    } catch (error) {
      console.error('Error creating conta:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nova Conta a Receber</h2>
              <p className="text-gray-400 text-sm">Cadastrar novo título</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados da Empresa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Building className="w-4 h-4 inline mr-2" />
                Empresa *
              </label>
              <input
                type="text"
                name="empresa"
                value={formData.empresa}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Nome da empresa"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ID da Empresa *
              </label>
              <input
                type="text"
                name="empresa_id"
                value={formData.empresa_id}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="ID único da empresa"
                required
              />
            </div>
          </div>

          {/* Dados do Documento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descrição *
              </label>
              <input
                type="text"
                name="descricao"
                value={formData.descricao}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Ex: Honorários contábeis - Janeiro 2025"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Documento *
              </label>
              <input
                type="text"
                name="documento"
                value={formData.documento}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Ex: NF-001, BOL-123"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Documento
              </label>
              <select
                name="tipo_documento"
                value={formData.tipo_documento}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
              >
                <option value="nf">Nota Fiscal</option>
                <option value="recibo">Recibo</option>
                <option value="boleto">Boleto</option>
                <option value="duplicata">Duplicata</option>
                <option value="promissoria">Promissória</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Forma de Pagamento
              </label>
              <select
                name="forma_pagamento"
                value={formData.forma_pagamento}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
              >
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
                <option value="especie">Espécie</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="cheque">Cheque</option>
                <option value="deposito">Depósito</option>
              </select>
            </div>
          </div>

          {/* Dados Financeiros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                Valor Original *
              </label>
              <input
                type="number"
                step="0.01"
                name="valor_original"
                value={formData.valor_original}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="0,00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Data de Emissão *
              </label>
              <input
                type="date"
                name="data_emissao"
                value={formData.data_emissao}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Data de Vencimento *
              </label>
              <input
                type="date"
                name="data_vencimento"
                value={formData.data_vencimento}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Gerar mais meses
              </label>
              <input
                type="number"
                min="0"
                max="36"
                name="gerar_mais_meses"
                value={formData.gerar_mais_meses}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">0 = apenas este mes, 1+ = recorrencia mensal adicional</p>
            </div>
          </div>

          {/* Dados Operacionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Conta Bancária
              </label>
              <input
                type="text"
                name="conta"
                value={formData.conta}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Ex: Banco do Brasil, Itaú"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Cidade de Atendimento *
              </label>
              <input
                type="text"
                name="cidade_atendimento"
                value={formData.cidade_atendimento}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Cidade"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Centro de Custo
              </label>
              <input
                type="text"
                name="centro_custo"
                value={formData.centro_custo}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Ex: Administrativo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Plano de Custo
              </label>
              <input
                type="text"
                name="plano_custo"
                value={formData.plano_custo}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Ex: Receitas"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Usuário Responsável
            </label>
            <input
              type="text"
              name="usuario_responsavel"
              value={formData.usuario_responsavel}
              onChange={handleInputChange}
              className="input-futuristic w-full px-3 py-2 rounded-lg"
              placeholder="Nome do responsável"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Observação
            </label>
            <textarea
              name="observacao"
              value={formData.observacao}
              onChange={handleInputChange}
              rows="3"
              className="input-futuristic w-full px-3 py-2 rounded-lg resize-none"
              placeholder="Observações adicionais..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-6 py-2 rounded-lg"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-futuristic px-6 py-2 rounded-lg"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Criando...</span>
                </div>
              ) : (
                'Criar Conta'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateContaModal;
