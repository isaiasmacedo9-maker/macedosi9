import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Heart,
  House,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquare,
  Send,
  Sparkles,
  PlayCircle,
  UserCircle2,
} from 'lucide-react';
import { getPortalMacedogramFeed, getPortalMacedogramProfiles } from '../../../dev/clientPortalData';

const atendimentoStyles = {
  municipal: 'bg-sky-500/15 text-sky-200 border border-sky-500/30',
  estadual: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  nacional: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
};

const ClientMacedogramPage = ({ authUser, clienteId }) => {
  const navigate = useNavigate();
  const profiles = useMemo(() => getPortalMacedogramProfiles(authUser), [authUser]);
  const feed = useMemo(() => getPortalMacedogramFeed(authUser), [authUser]);
  const [activeSection, setActiveSection] = useState('inicio');
  const [likedPosts, setLikedPosts] = useState({});
  const [commentsByPost, setCommentsByPost] = useState(() =>
    Object.fromEntries(feed.map((post) => [post.id, post.comentarios || []])),
  );
  const [draftByPost, setDraftByPost] = useState({});

  const toggleLike = (postId) => {
    setLikedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleDraftChange = (postId, value) => {
    setDraftByPost((prev) => ({ ...prev, [postId]: value }));
  };

  const handleAddComment = (postId) => {
    const raw = (draftByPost[postId] || '').trim();
    if (!raw) return;
    const novoComentario = {
      id: `cmt-${postId}-${Date.now()}`,
      autor: 'Você',
      texto: raw,
      data: new Date().toISOString(),
    };
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), novoComentario],
    }));
    setDraftByPost((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleSendMessage = (empresa) => {
    alert(`Mensagem para ${empresa} simulada com sucesso.`);
  };

  const activeProfile = useMemo(
    () => profiles.find((item) => item.clienteId === clienteId) || profiles[0] || null,
    [profiles, clienteId],
  );
  const activeCompanyFeed = useMemo(
    () => feed.filter((item) => item.clienteId === (activeProfile?.clienteId || clienteId)),
    [feed, activeProfile, clienteId],
  );

  const menuItems = [
    { id: 'inicio', label: 'Início', icon: House },
    { id: 'mensagens', label: 'Mensagens', icon: MessageSquare },
    { id: 'perfil', label: 'Perfil', icon: UserCircle2 },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="glass-intense rounded-[24px] border border-white/10 p-4">
        <button
          type="button"
          onClick={() => navigate(`/cliente/${clienteId || 'todas'}`)}
          className="mb-4 flex w-full items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? 'border border-red-500/35 bg-red-500/15 font-semibold text-white'
                    : 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="space-y-6">
        <div className="glass-intense rounded-[28px] border border-white/8 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-200">
                <Sparkles className="mr-2 h-4 w-4" />
                Macedogram
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {activeSection === 'inicio' ? 'Feed principal do Macedogram' : activeSection === 'mensagens' ? 'Mensagens' : 'Perfil da empresa'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-300">
                {activeSection === 'inicio'
                  ? 'Timeline de empresas com publicacoes de rotina, midias e atualizacoes para acompanhamento contabil.'
                  : activeSection === 'mensagens'
                    ? 'Lista interna de conversas entre empresas e equipe contábil.'
                    : 'Visao resumida da empresa ativa dentro do Macedogram.'}
              </p>
            </div>
          </div>
        </div>

        {activeSection === 'inicio' ? (
          <div className="space-y-5">
            {activeProfile ? (
              <article className="glass rounded-[24px] border border-white/10 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-800 text-lg font-bold text-white">
                    {activeProfile.logo_sigla}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">{activeProfile.nome_empresa}</p>
                    <p className="truncate text-xs text-gray-400">{activeProfile.nome_fantasia}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-gray-200">{activeProfile.descricao}</p>
                <div className="mt-4 space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs text-gray-300">
                    <MapPin className="h-3.5 w-3.5" />
                    {activeProfile.cidade}
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${atendimentoStyles[activeProfile.tipo_atendimento] || atendimentoStyles.municipal}`}>
                      Atendimento {activeProfile.tipo_atendimento}
                    </span>
                  </div>
                </div>
              </article>
            ) : null}

            {activeCompanyFeed.map((post) => (
                <article
                  key={post.id}
                  className="glass rounded-[24px] border border-white/10 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.24)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white">
                        {post.logo_sigla || 'EM'}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white">{post.nome_empresa}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(post.data_publicacao).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <Building2 className="h-4 w-4 text-gray-500" />
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                    {post.midia?.tipo === 'video' ? (
                      <div className="relative">
                        <video
                          controls
                          preload="metadata"
                          poster={post.midia.poster}
                          className="h-auto max-h-[460px] w-full object-cover"
                        >
                          <source src={post.midia.url} type="video/mp4" />
                        </video>
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
                          <PlayCircle className="h-3.5 w-3.5" />
                          Video
                        </span>
                      </div>
                    ) : (
                      <img
                        src={post.midia?.url}
                        alt={`Publicacao de ${post.nome_empresa}`}
                        className="h-auto max-h-[460px] w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>

                  <p className="mt-4 text-sm leading-6 text-gray-200">{post.legenda}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleLike(post.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition ${
                        likedPosts[post.id]
                          ? 'border-red-500/40 bg-red-500/15 text-red-200'
                          : 'border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${likedPosts[post.id] ? 'fill-red-300 text-red-300' : ''}`} />
                      {likedPosts[post.id] ? 'Curtido' : 'Curtir'}
                    </button>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-gray-300">
                      <MessageCircle className="h-4 w-4" />
                      Comentar
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(post.nome_empresa)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-500/15 px-3 py-1.5 text-sky-200 transition hover:bg-sky-500/25"
                    >
                      <Send className="h-4 w-4" />
                      Enviar mensagem
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="space-y-2">
                      {(commentsByPost[post.id] || []).map((comentario) => (
                        <div key={comentario.id} className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
                          <p className="text-xs font-semibold text-white">{comentario.autor}</p>
                          <p className="mt-1 text-xs text-gray-300">{comentario.texto}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={draftByPost[post.id] || ''}
                        onChange={(e) => handleDraftChange(post.id, e.target.value)}
                        placeholder="Escreva um comentario..."
                        className="w-full rounded-xl border border-white/10 bg-zinc-900/90 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment(post.id)}
                        className="rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-100 transition hover:bg-red-500/25"
                      >
                        Comentar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        ) : null}

        {activeSection === 'mensagens' ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {profiles.map((profile) => (
              <article
                key={`chat-${profile.clienteId}`}
                className="glass rounded-[20px] border border-white/10 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-sm font-bold text-white">
                    {profile.logo_sigla}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{profile.nome_fantasia}</p>
                    <p className="text-xs text-gray-400">Última mensagem: hoje 14:20</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-300">
                  Conversa pronta para fluxo de direct empresarial com histórico e anexos (mock).
                </p>
              </article>
            ))}
          </div>
        ) : null}

        {activeSection === 'perfil' ? (
          activeProfile ? (
            <article className="glass rounded-[24px] border border-white/10 p-6 shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-800 text-xl font-bold text-white">
                  {activeProfile.logo_sigla}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{activeProfile.nome_empresa}</h2>
                  <p className="text-sm text-gray-400">{activeProfile.nome_fantasia}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-200">{activeProfile.descricao}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-200">
                  <MapPin className="h-3.5 w-3.5" />
                  {activeProfile.cidade}
                </span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${atendimentoStyles[activeProfile.tipo_atendimento] || atendimentoStyles.municipal}`}>
                  Atendimento {activeProfile.tipo_atendimento}
                </span>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="text-sm font-semibold text-white">Trocar perfil de empresa</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {profiles.map((profile) => (
                    <button
                      key={`switch-${profile.clienteId}`}
                      type="button"
                      onClick={() => navigate(`/cliente/${profile.clienteId}/macedogram`)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                        profile.clienteId === activeProfile.clienteId
                          ? 'border-red-500/40 bg-red-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <p className="font-medium">{profile.nome_fantasia}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{profile.cidade}</p>
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ) : (
            <div className="glass rounded-[24px] border border-white/10 p-6 text-sm text-gray-300">
              Nenhum perfil disponível para a empresa ativa.
            </div>
          )
        ) : null}
      </section>
    </div>
  );
};

export default ClientMacedogramPage;
