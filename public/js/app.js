import { abrirTextoWhats, campoMudou, editorDe, excluirEnquete, mudarStatus, novoEditor, renderEditor, salvarEditor } from './enquetes.js';
import { instalarApp } from './instalar.js';
import { copiarLink, criarLinkPara, enviarLinkWhats, gerarTodosLinks, revogarLink } from './links.js';
import { $, SEM_ACESSO, erroAmigavel, estado, fecharModal, fonteGrande, gravarPref, pubPorId, rotuloFonte, tentar, toast } from './nucleo.js';
import { excluirPublicador, formularioPublicador, salvarPublicadorForm } from './publicadores.js';
import { carregarBase, entrarComLink, iniciar, renderLogin } from './sessao.js';
import { abrirMenu, fecharMenu, renderAba, renderApp } from './shell.js';
import { atualizarResumoCelula, desenharEscala, editarCelula, exportarExcel, gerarEscalaAcao, gravarCelula, imprimir, publicarEscala } from './telaEscala.js';
import { excluirRegistroUsuario, reativarUsuario, removerAcesso, salvarUsuario } from './usuarios.js';
import { alternarVoto, copiarPonto, marcarPonto, renderAreaVoto, salvarVoto, usarCostume } from './votar.js';
import { abrirLembreteGrupo, lembrar, votarPor } from './votos.js';
import { abrirPrivacidade, baixarBackup, limparDadosAntigos } from './dados.js';
import { normalizarPapel } from './data.js';
import { filtrarLinhas } from './busca.js';
import { baixarICS } from './telaMinha.js';
import {
  renderPontos, nomeDoPontoMudou, pontoAtivoMudou, adicionarPonto, moverPonto, removerPonto, desfazerPontos, salvarPontos,
} from './telaPontos.js';

/* ============================================================ eventos */

const acoes = {
  aba: (el) => { estado.aba = el.dataset.id; estado.ed = null; estado.pontosEd = null; renderApp(); },
  menu: () => (estado.menuAberto ? fecharMenu() : abrirMenu()),
  'fechar-menu': fecharMenu,
  privacidade: () => { fecharMenu(); abrirPrivacidade(); },
  backup: baixarBackup,
  'limpar-antigos': limparDadosAntigos,
  'fechar-menu-fundo': (el, e) => { if (e.target === el) fecharMenu(); },
  sair: () => {
    if (estado.perfil?.conviteId && !confirm('Se sair, você vai precisar tocar no seu link pessoal outra vez para entrar. Sair mesmo?')) return;
    estado.backend.sair();
  },
  fonte: () => {
    const grande = !fonteGrande();
    document.documentElement.classList.toggle('fonte-grande', grande);
    gravarPref('fonte', grande ? 'grande' : 'normal');
    document.querySelectorAll('[data-acao=fonte]').forEach((b) => { b.textContent = rotuloFonte(); });
  },
  'entrar-demo': (el) => estado.backend.entrarDemo(el.dataset.id),
  'reiniciar-demo': () => { if (confirm('Voltar aos dados de exemplo?')) { estado.backend.reiniciarDemo(); location.reload(); } },
  'modo-login': (el) => renderLogin(el.dataset.id),
  instalar: () => { fecharMenu(); instalarApp(); },
  'entrar-com-link': entrarComLink,
  'previa-login': () => { estado.previaLogin = true; renderLogin('entrar'); },
  'sair-previa': () => { estado.previaLogin = false; renderLogin(); },
  'esqueci-senha': async () => {
    const email = $('#lg-email').value.trim();
    if (!email) return toast('Digite o seu e-mail no campo acima.', 'erro');
    await tentar(() => estado.backend.resetSenha(email), 'Se o e-mail existir, enviamos o link para redefinir a senha.');
  },
  'atualizar-perfil': async () => {
    const perfil = await estado.backend.getUsuario(estado.perfil.uid);
    estado.perfil = { ...perfil, papel: normalizarPapel(perfil.papel), uid: estado.perfil.uid };
    if (!SEM_ACESSO.includes(perfil.papel)) await carregarBase();
    renderApp();
  },
  'fechar-modal': fecharModal,
  'fechar-modal-fundo': (el, e) => { if (e.target === el) fecharModal(); },

  'escolher-enquete': (el) => { estado.enqueteId = el.value; estado.ponto = null; renderAba(); },
  'escolher-ponto': (el) => { estado.ponto = el.dataset.id; desenharEscala(); },

  'alternar-voto': alternarVoto,
  'marcar-tudo': (el) => marcarPonto(el.dataset.ponto, true),
  'limpar-ponto': (el) => marcarPonto(el.dataset.ponto, false),
  'salvar-voto': salvarVoto,
  'usar-costume': usarCostume,
  'guardar-costume': (el) => { estado.voto.guardarPadrao = el.checked; },
  'lembrar': (el) => lembrar(el.dataset.id),
  'lembrar-grupo': () => abrirLembreteGrupo(),
  'abrir-whats-texto': () => window.open(`https://wa.me/?text=${encodeURIComponent($('#texto-whats').value)}`, '_blank', 'noopener'),
  'copiar-ponto': (el) => copiarPonto(el.dataset.ponto),
  'filtro-ponto': (el) => { estado.voto.filtro = el.dataset.ponto; gravarPref('filtro-ponto', estado.voto.filtro); renderAreaVoto(); },
  'votar-por': (el) => votarPor(el.dataset.id),

  'novo-publicador': () => formularioPublicador(null),
  'editar-publicador': (el) => formularioPublicador(el.dataset.id),
  'excluir-publicador': (el) => excluirPublicador(el.dataset.id),

  'nova-enquete': () => { estado.ed = novoEditor(); renderAba(); },

  'ponto-adicionar': adicionarPonto,
  'ponto-subir': (el) => moverPonto(Number(el.dataset.id), -1),
  'ponto-descer': (el) => moverPonto(Number(el.dataset.id), 1),
  'ponto-remover': (el) => removerPonto(Number(el.dataset.id)),
  'pontos-desfazer': desfazerPontos,
  'pontos-salvar': salvarPontos,
  'editar-enquete': (el) => { estado.ed = editorDe(estado.enquetes.find((e) => e.id === el.dataset.id)); renderAba(); },
  'duplicar-enquete': (el) => { estado.ed = editorDe(estado.enquetes.find((e) => e.id === el.dataset.id), true); renderAba(); },
  'cancelar-editor': () => { estado.ed = null; renderAba(); },
  'salvar-enquete': (el) => salvarEditor(el.dataset.id),
  'abrir-votacao': (el) => mudarStatus(el.dataset.id, 'aberta', 'Votação aberta.'),
  'encerrar-votacao': (el) => mudarStatus(el.dataset.id, 'fechada', 'Votação encerrada.'),
  'excluir-enquete': (el) => excluirEnquete(el.dataset.id),
  'ver-votos': (el) => { estado.enqueteId = el.dataset.id; estado.aba = 'votos'; renderApp(); },
  'montar-escala': (el) => { estado.enqueteId = el.dataset.id; estado.ponto = null; estado.aba = 'escala'; renderApp(); },
  'texto-whats': (el) => abrirTextoWhats(el.dataset.id),
  'copiar-whats': async () => {
    const texto = $('#texto-whats');
    try { await navigator.clipboard.writeText(texto.value); toast('Texto copiado.'); } catch { texto.select(); toast('Selecione e copie o texto.'); }
  },
  'add-bloqueio': () => {
    const data = $('#bl-dia').value;
    const turno = $('#bl-turno').value;
    if (!data || !turno) return toast('Escolha o dia e o horário.', 'erro');
    estado.ed.bloqueios.push({ data, turno, ponto: $('#bl-ponto').value, motivo: $('#bl-motivo').value.trim() });
    renderEditor();
  },
  'del-bloqueio': (el) => { estado.ed.bloqueios.splice(Number(el.dataset.id), 1); renderEditor(); },

  'baixar-ics': baixarICS,
  'gerar-escala': gerarEscalaAcao,
  'publicar-escala': () => publicarEscala(true),
  'despublicar-escala': () => publicarEscala(false),
  imprimir: () => imprimir(false),
  'imprimir-todos': () => imprimir(true),
  'exportar-excel': exportarExcel,
  'editar-celula': (el) => editarCelula(el.dataset.ponto, el.dataset.data, el.dataset.turno),
  'limpar-celula': () => gravarCelula([]),
  'salvar-celula': () => {
    const pessoas = [...document.querySelectorAll('#modal input[name=celula]:checked')]
      .map((i) => pubPorId(i.value)).filter(Boolean).map((p) => ({ id: p.id, nome: p.nome }));
    gravarCelula(pessoas);
  },

  'salvar-usuario': (el) => salvarUsuario(el.dataset.id),
  'remover-usuario': (el) => removerAcesso(el.dataset.id),
  'reativar-usuario': (el) => reativarUsuario(el.dataset.id),
  'excluir-usuario': (el) => excluirRegistroUsuario(el.dataset.id),

  'gerar-link': async (el) => { if (await criarLinkPara(el.dataset.id)) renderAba(); },
  'gerar-todos-links': gerarTodosLinks,
  'copiar-link': (el) => copiarLink(el.dataset.id),
  'whats-link': (el) => enviarLinkWhats(el.dataset.id),
  'revogar-link': (el) => revogarLink(el.dataset.id),
  'testar-link': async (el) => { await estado.backend.resgatarConvite(el.dataset.id); estado.aba = null; },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-acao]');
  if (!el || el.tagName === 'SELECT') return;
  acoes[el.dataset.acao]?.(el, e);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'ponto-novo') { e.preventDefault(); adicionarPonto(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('td.celula-editavel')) {
    e.preventDefault();
    e.target.click();
  }
  if (e.key === 'Escape') { if ($('#modal').innerHTML) fecharModal(); else fecharMenu(); }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('select[data-acao]')) acoes[el.dataset.acao]?.(el, e);
  else if (el.matches('[data-ponto-ativo]')) pontoAtivoMudou(el);
  else if (el.matches('[data-ponto-nome]')) renderPontos(); // ao sair do campo, mostra "Antes: ..." e libera o Salvar
  else if (el.name === 'celula') atualizarResumoCelula();
  else if (el.name === 'pb-onde') document.querySelectorAll('input[name=pb-ponto]').forEach((i) => { i.disabled = el.value !== 'alguns'; });
  else if (el.dataset.campo) campoMudou(el);
});

document.addEventListener('input', (e) => {
  if (e.target.matches('[data-busca-campo]')) filtrarLinhas(e.target);
  else if (e.target.matches('[data-ponto-nome]')) nomeDoPontoMudou(e.target);
  else if (e.target.dataset.campo) campoMudou(e.target, true);
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  if (form.id === 'form-publicador') return salvarPublicadorForm(form);

  if (form.id === 'form-login') {
    const novo = Boolean($('#lg-nome'));
    const erro = $('#lg-erro');
    erro.classList.add('hidden');
    if (estado.backend.modo === 'demo') {
      erro.textContent = 'Modo demonstração: o login por e-mail só funciona depois de configurar o Firebase.';
      erro.classList.remove('hidden');
      return;
    }
    try {
      const email = $('#lg-email').value.trim();
      const senha = $('#lg-senha').value;
      if (novo) {
        const nome = $('#lg-nome').value.trim();
        if (!nome) throw { code: 'x-nome' };
        await estado.backend.registrar(nome, email, senha);
      } else {
        await estado.backend.login(email, senha);
      }
    } catch (err) {
      erro.textContent = err.code === 'x-nome' ? 'Informe o seu nome.' : erroAmigavel(err);
      erro.classList.remove('hidden');
    }
  }
});

iniciar();
