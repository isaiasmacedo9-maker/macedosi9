import React, { useState } from 'react';
import { X, DollarSign, Calendar, CreditCard, MessageSquare } from 'lucide-react';

const PaymentModal = ({ isOpen, onClose, onSubmit, conta }) => {
  const [formData, setFormData] = useState({
    data_recebimento: new Date().toISOString().split('T')[0],
    valor_recebido: conta?.valor_original || '',
    forma_pagamento: 'boleto',
    desconto_aplicado: 0,
    acrescimo_aplicado: 0,
    troco: 0,
    observacao: '',
    usuario_responsavel: ''
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(conta.id, {
        ...formData,
        valor_recebido: parseFloat(formData.valor_recebido),
        desconto_aplicado: parseFloat(formData.desconto_aplicado || 0),
        acrescimo_aplicado: parseFloat(formData.acrescimo_aplicado || 0),
        troco: parseFloat(formData.troco || 0)
      });
    } catch (error) {
      console.error('Error processing payment:', error);
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

  const calcularLiquido = () => {
    const valor = parseFloat(formData.valor_recebido || 0);
    const desconto = parseFloat(formData.desconto_aplicado || 0);
    const acrescimo = parseFloat(formData.acrescimo_aplicado || 0);
    return valor - desconto + acrescimo;
  };

  if (!isOpen || !conta) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Dar Baixa no Título</h2>
              <p className="text-gray-400 text-sm">{conta.empresa}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Informações do Título */}
        <div className="glass-inner rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Documento:</p>
              <p className="text-white font-mono">{conta.documento}</p>
            </div>
            <div>
              <p className="text-gray-400">Valor Original:</p>
              <p className="text-green-400 font-semibold">R$ {conta.valor_original?.toLocaleString('pt-BR') || '0,00'}</p>
            </div>
            <div>
              <p className="text-gray-400">Vencimento:</p>
              <p className="text-white">{new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-gray-400">Situação:</p>
              <span className="px-2 py-1 rounded-full text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-600/30">
                {conta.situacao?.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Data de Recebimento *
              </label>
              <input
                type="date"
                name="data_recebimento"
                value={formData.data_recebimento}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                Valor Recebido *
              </label>
              <input
                type="number"
                step="0.01"
                name="valor_recebido"
                value={formData.valor_recebido}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <CreditCard className="w-4 h-4 inline mr-2" />
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Desconto
              </label>
              <input
                type="number"
                step="0.01"
                name="desconto_aplicado"
                value={formData.desconto_aplicado}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Acréscimo
              </label>
              <input
                type="number"
                step="0.01"
                name="acrescimo_aplicado"
                value={formData.acrescimo_aplicado}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Troco
              </label>
              <input
                type="number"
                step="0.01"
                name="troco"
                value={formData.troco}
                onChange={handleInputChange}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Resumo do Pagamento */}
          <div className="glass-inner rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Valor Líquido:</span>
              <span className="text-green-400 font-bold text-lg">
                R$ {calcularLiquido().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Observação
            </label>
            <textarea
              name="observacao"
              value={formData.observacao}
              onChange={handleInputChange}
              rows="3"
              className="input-futuristic w-full px-3 py-2 rounded-lg resize-none"
              placeholder="Observações sobre o pagamento..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
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
              className="btn-success px-6 py-2 rounded-lg"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Processando...</span>
                </div>
              ) : (
                'Confirmar Baixa'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;