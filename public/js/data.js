// Camada de dados: o app só fala com este arquivo.
// Há dois "backends" com a mesma interface: Firebase (de verdade) e demonstração (localStorage).

import { toISO } from './escala.js';

const FIREBASE_VERSAO = '10.14.1';

export const PAPEIS = {
  pendente: 'Aguardando aprovação',
  votante: 'Votante',
  servo: 'Servo ministerial',
  anciao: 'Ancião',
  admin: 'Administrador',
  removido: 'Acesso removido',
};

export const ORGANIZADORES = ['servo', 'anciao', 'admin'];

export const CONFIG_PADRAO = {
  pontos: ['Bairro Novo', 'Atacadão Novo Mix', 'Morada dos Canários e Sabiás'],
  turnos: ['06:00 às 08:00', '08:00 às 10:00', '10:00 às 12:00', '14:00 às 16:00', '16:00 às 18:00', '18:00 às 20:00'],
  // diaSemana: 0 = domingo ... 6 = sábado
  bloqueiosPadrao: [{ diaSemana: 4, turno: '18:00 às 20:00', motivo: 'Reunião de meio de semana' }],
};

export function configurado(cfg) {
  return Boolean(cfg && cfg.apiKey && cfg.appId);
}

/* ------------------------------------------------------------------ Firebase */

export async function criarBackendFirebase(cfg) {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSAO}/`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${base}firebase-app.js`),
    import(`${base}firebase-auth.js`),
    import(`${base}firebase-firestore.js`),
  ]);

  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);

  const col = (...caminho) => F.collection(db, ...caminho);
  const ref = (...caminho) => F.doc(db, ...caminho);
  const comId = (d) => ({ id: d.id, ...d.data() });
  const lista = async (...caminho) => (await F.getDocs(col(...caminho))).docs.map(comId);
  const um = async (...caminho) => {
    const d = await F.getDoc(ref(...caminho));
    return d.exists() ? comId(d) : null;
  };
  const semId = ({ id, ...resto }) => resto;
  let nomeNovo = null;

  return {
    modo: 'firebase',

    onAuth(cb) {
      return A.onAuthStateChanged(auth, (u) =>
        cb(u ? { uid: u.uid, email: u.email, nome: u.displayName || nomeNovo || '', anonimo: u.isAnonymous } : null)
      );
    },
    usuarioAtual() {
      const u = auth.currentUser;
      return u ? { uid: u.uid, email: u.email, nome: u.displayName || nomeNovo || '', anonimo: u.isAnonymous } : null;
    },
    async login(email, senha) {
      await A.signInWithEmailAndPassword(auth, email, senha);
    },
    async registrar(nome, email, senha) {
      // O documento do usuário (papel "pendente") é criado pelo app logo após o login,
      // em um lugar só, para não haver duas gravações disputando o mesmo documento.
      nomeNovo = nome;
      const cred = await A.createUserWithEmailAndPassword(auth, email, senha);
      await A.updateProfile(cred.user, { displayName: nome });
    },
    async sair() {
      await A.signOut(auth);
    },
    async resetSenha(email) {
      await A.sendPasswordResetEmail(auth, email);
    },

    getUsuario: (uid) => um('usuarios', uid),
    async criarUsuarioPendente(uid, nome, email) {
      await F.setDoc(ref('usuarios', uid), { nome, email, papel: 'pendente', publicadorId: null, criadoEm: F.serverTimestamp() });
    },
    listarUsuarios: () => lista('usuarios'),
    atualizarUsuario: (uid, dados) => F.updateDoc(ref('usuarios', uid), dados),
    excluirUsuario: (uid) => F.deleteDoc(ref('usuarios', uid)),

    // Link pessoal: o código secreto do link é o próprio id do documento em "convites".
    listarConvites: () => lista('convites'),
    criarConvite: (token, dados) => F.setDoc(ref('convites', token), { ...dados, ativo: true, criadoEm: F.serverTimestamp() }),
    async revogarConvite(token) {
      const q = F.query(col('usuarios'), F.where('conviteId', '==', token));
      for (const d of (await F.getDocs(q)).docs) await F.deleteDoc(d.ref);
      await F.deleteDoc(ref('convites', token));
    },
    async resgatarConvite(token) {
      let u = auth.currentUser;
      if (u && !u.isAnonymous) return { ignorado: true }; // já entrou com e-mail e senha
      if (!u) u = (await A.signInAnonymously(auth)).user;

      const convite = await um('convites', token);
      if (!convite || convite.ativo !== true) {
        const e = new Error('convite-invalido');
        e.code = 'app/convite-invalido';
        throw e;
      }

      const existente = await um('usuarios', u.uid);
      if (existente && existente.conviteId === token) return { uid: u.uid };
      if (existente) {
        // Este aparelho já estava ligado a outro link: começa uma sessão nova.
        await A.signOut(auth);
        u = (await A.signInAnonymously(auth)).user;
      }

      await F.setDoc(ref('usuarios', u.uid), {
        nome: convite.nome,
        email: null,
        papel: 'votante',
        publicadorId: convite.publicadorId,
        conviteId: token,
        criadoEm: F.serverTimestamp(),
      });
      return { uid: u.uid };
    },

    listarPublicadores: () => lista('publicadores'),
    getPublicador: (id) => um('publicadores', id),
    async salvarPublicador(p) {
      const id = p.id || F.doc(col('publicadores')).id;
      await F.setDoc(ref('publicadores', id), semId(p));
      return id;
    },
    excluirPublicador: (id) => F.deleteDoc(ref('publicadores', id)),

    async getConfig() {
      return (await um('config', 'geral')) || { ...CONFIG_PADRAO };
    },
    salvarConfig: (cfgGeral) => F.setDoc(ref('config', 'geral'), semId(cfgGeral)),

    async listarEnquetes({ somenteVisiveis = false } = {}) {
      const consulta = somenteVisiveis
        ? F.query(col('enquetes'), F.where('status', 'in', ['aberta', 'fechada', 'publicada']))
        : col('enquetes');
      const itens = (await F.getDocs(consulta)).docs.map(comId);
      return itens.sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    },
    getEnquete: (id) => um('enquetes', id),
    async salvarEnquete(e) {
      const id = e.id || F.doc(col('enquetes')).id;
      await F.setDoc(ref('enquetes', id), semId(e));
      return id;
    },
    async excluirEnquete(id) {
      for (const v of await lista('enquetes', id, 'votos')) await F.deleteDoc(ref('enquetes', id, 'votos', v.id));
      await F.deleteDoc(ref('enquetes', id, 'escala', 'atual'));
      await F.deleteDoc(ref('enquetes', id));
    },

    listarVotos: (enqueteId) => lista('enquetes', enqueteId, 'votos'),
    getVoto: (enqueteId, pubId) => um('enquetes', enqueteId, 'votos', pubId),
    salvarVoto: (enqueteId, pubId, dados) =>
      F.setDoc(ref('enquetes', enqueteId, 'votos', pubId), { ...dados, publicadorId: pubId, atualizadoEm: F.serverTimestamp() }),

    getEscala: (enqueteId) => um('enquetes', enqueteId, 'escala', 'atual'),
    salvarEscala: (enqueteId, dados) =>
      F.setDoc(ref('enquetes', enqueteId, 'escala', 'atual'), { ...semId(dados), atualizadoEm: F.serverTimestamp() }),
  };
}

/* --------------------------------------------------------------- Demonstração */

// localStorage, ou memória se o navegador bloquear o armazenamento (aba anônima, por exemplo).
function abrirArmazenamento() {
  try {
    localStorage.setItem('tp:teste', '1');
    localStorage.removeItem('tp:teste');
    return {
      get: (k) => localStorage.getItem(k),
      set: (k, v) => localStorage.setItem(k, v),
      del: (k) => localStorage.removeItem(k),
      chaves: () => Object.keys(localStorage),
    };
  } catch {
    const m = new Map();
    return {
      get: (k) => (m.has(k) ? m.get(k) : null),
      set: (k, v) => m.set(k, String(v)),
      del: (k) => m.delete(k),
      chaves: () => [...m.keys()],
    };
  }
}

const USUARIOS_DEMO = [
  { id: 'demo-admin', nome: 'Administrador (demo)', email: 'admin@demo.local', papel: 'admin', publicadorId: 'p3' },
  { id: 'u3', nome: 'Paulo (exemplo)', email: 'paulo@exemplo.com', papel: 'anciao', publicadorId: 'p1' },
  { id: 'u2', nome: 'Carlos (exemplo)', email: 'carlos@exemplo.com', papel: 'votante', publicadorId: 'p9' },
  { id: 'u1', nome: 'Maria (exemplo)', email: 'maria@exemplo.com', papel: 'pendente', publicadorId: null },
];

export function criarBackendDemo() {
  const P = 'tp:demo:';
  const arm = abrirArmazenamento();
  const ler = (k, padrao) => {
    try {
      const v = arm.get(P + k);
      return v === null ? padrao : JSON.parse(v);
    } catch {
      return padrao;
    }
  };
  const gravar = (k, v) => arm.set(P + k, JSON.stringify(v));
  const novoId = () => Math.random().toString(36).slice(2, 10);
  let ouvinte = null;

  function proximaSegunda() {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    return d;
  }

  function semear() {
    if (ler('semeado', false)) return;
    const pubs = [
      { id: 'p1', nome: 'Paulo', genero: 'M', conjuge: 'p2', requerTrio: false, ativo: true },
      { id: 'p2', nome: 'Marta', genero: 'F', conjuge: 'p1', requerTrio: false, ativo: true },
      { id: 'p3', nome: 'Ricardo', genero: 'M', conjuge: '', requerTrio: false, ativo: true },
      { id: 'p4', nome: 'Helena', genero: 'F', conjuge: '', requerTrio: false, ativo: true },
      { id: 'p5', nome: 'Bruno', genero: 'M', conjuge: '', requerTrio: false, ativo: true },
      { id: 'p6', nome: 'Luciana', genero: 'F', conjuge: '', requerTrio: false, ativo: true },
      { id: 'p7', nome: 'Davi', genero: 'M', conjuge: 'p8', requerTrio: false, ativo: true },
      { id: 'p8', nome: 'Sara', genero: 'F', conjuge: 'p7', requerTrio: false, ativo: true },
      { id: 'p9', nome: 'Tiago', genero: 'M', conjuge: '', requerTrio: false, ativo: true },
      { id: 'p10', nome: 'Rita', genero: 'F', conjuge: '', requerTrio: false, ativo: true },
      { id: 'p11', nome: 'Eduardo', genero: 'M', conjuge: '', requerTrio: true, ativo: true },
      { id: 'p12', nome: 'Alice', genero: 'F', conjuge: '', requerTrio: true, ativo: true },
    ];
    gravar('publicadores', pubs);
    gravar('config', CONFIG_PADRAO);

    const inicio = proximaSegunda();
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 5);
    const dias = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      dias.push({ data: toISO(d), ativo: true, motivo: '' });
    }
    const quinta = dias[3].data;
    gravar('enquetes', [
      {
        id: 'e1',
        titulo: `Semana de ${toISO(inicio).slice(8)}/${toISO(inicio).slice(5, 7)} a ${toISO(fim).slice(8)}/${toISO(fim).slice(5, 7)}`,
        tipo: 'semana',
        status: 'aberta',
        inicio: toISO(inicio),
        fim: toISO(fim),
        dias,
        turnos: CONFIG_PADRAO.turnos,
        pontos: CONFIG_PADRAO.pontos,
        bloqueios: [{ data: quinta, turno: '18:00 às 20:00', motivo: 'Reunião de meio de semana' }],
        regras: { maxIrmas: 3, parFixoJunto: true },
      },
    ]);
    gravar('votos', {});
    gravar('escalas', {});
    gravar('semeado', true);
  }

  semear();

  const sessao = () => ler('sessao', null);

  return {
    modo: 'demo',

    onAuth(cb) {
      ouvinte = cb;
      const s = sessao();
      setTimeout(() => cb(s ? { uid: s.uid, email: s.email, nome: s.nome } : null), 0);
      return () => { ouvinte = null; };
    },
    usuarioAtual() {
      const s = sessao();
      return s ? { uid: s.uid, email: s.email, nome: s.nome, anonimo: Boolean(s.conviteId) } : null;
    },
    async login() { throw new Error('demo'); },
    async registrar() { throw new Error('demo'); },
    async resetSenha() { throw new Error('demo'); },
    async sair() {
      arm.del(P + 'sessao');
      if (ouvinte) ouvinte(null);
    },

    /** Só existe na demonstração: entra direto com um perfil. */
    entrarDemo(papel) {
      const nomes = { admin: 'Administrador (demo)', anciao: 'Ancião (demo)', servo: 'Servo (demo)', votante: 'Votante (demo)' };
      const vinculo = { admin: 'p3', anciao: 'p1', servo: 'p5', votante: 'p4' };
      const s = { uid: `demo-${papel}`, email: `${papel}@demo.local`, nome: nomes[papel], papel, publicadorId: vinculo[papel] };
      gravar('sessao', s);
      if (ouvinte) ouvinte({ uid: s.uid, email: s.email, nome: s.nome });
    },
    reiniciarDemo() {
      arm.chaves().filter((k) => k.startsWith(P) && k !== `${P}sessao`).forEach((k) => arm.del(k));
      semear();
    },

    async getUsuario() {
      const s = sessao();
      if (!s) return null;
      const guardado = ler('usuarios', USUARIOS_DEMO).find((u) => u.id === s.uid);
      return { id: s.uid, nome: s.nome, email: s.email, papel: guardado?.papel || s.papel, publicadorId: guardado?.publicadorId ?? s.publicadorId, conviteId: s.conviteId };
    },
    async criarUsuarioPendente() {},
    async listarUsuarios() { return ler('usuarios', USUARIOS_DEMO); },
    async atualizarUsuario(uid, dados) {
      gravar('usuarios', ler('usuarios', USUARIOS_DEMO).map((u) => (u.id === uid ? { ...u, ...dados } : u)));
    },
    async excluirUsuario(uid) {
      gravar('usuarios', ler('usuarios', USUARIOS_DEMO).filter((u) => u.id !== uid));
    },

    async listarConvites() { return Object.values(ler('convites', {})); },
    async criarConvite(token, dados) {
      const convites = ler('convites', {});
      convites[token] = { ...dados, id: token, ativo: true };
      gravar('convites', convites);
    },
    async revogarConvite(token) {
      const convites = ler('convites', {});
      delete convites[token];
      gravar('convites', convites);
      gravar('usuarios', ler('usuarios', USUARIOS_DEMO).filter((u) => u.conviteId !== token));
    },
    async resgatarConvite(token) {
      const convite = ler('convites', {})[token];
      if (!convite || convite.ativo !== true) {
        const e = new Error('convite-invalido');
        e.code = 'app/convite-invalido';
        throw e;
      }
      const uid = `link-${convite.publicadorId}`;
      const usuarios = ler('usuarios', USUARIOS_DEMO);
      if (!usuarios.some((u) => u.id === uid)) {
        usuarios.push({ id: uid, nome: convite.nome, email: null, papel: 'votante', publicadorId: convite.publicadorId, conviteId: token });
        gravar('usuarios', usuarios);
      }
      gravar('sessao', { uid, email: '', nome: convite.nome, papel: 'votante', publicadorId: convite.publicadorId, conviteId: token });
      if (ouvinte) ouvinte({ uid, email: '', nome: convite.nome, anonimo: true });
      return { uid };
    },

    async listarPublicadores() { return ler('publicadores', []); },
    async getPublicador(id) { return ler('publicadores', []).find((p) => p.id === id) || null; },
    async salvarPublicador(p) {
      const lista = ler('publicadores', []);
      const id = p.id || novoId();
      const item = { ...p, id };
      const i = lista.findIndex((x) => x.id === id);
      if (i >= 0) lista[i] = item; else lista.push(item);
      gravar('publicadores', lista);
      return id;
    },
    async excluirPublicador(id) { gravar('publicadores', ler('publicadores', []).filter((p) => p.id !== id)); },

    async getConfig() { return ler('config', { ...CONFIG_PADRAO }); },
    async salvarConfig(c) { gravar('config', c); },

    async listarEnquetes({ somenteVisiveis = false } = {}) {
      const itens = ler('enquetes', []).filter((e) => !somenteVisiveis || e.status !== 'rascunho');
      return itens.sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    },
    async getEnquete(id) { return ler('enquetes', []).find((e) => e.id === id) || null; },
    async salvarEnquete(e) {
      const lista = ler('enquetes', []);
      const id = e.id || novoId();
      const item = { ...e, id };
      const i = lista.findIndex((x) => x.id === id);
      if (i >= 0) lista[i] = item; else lista.push(item);
      gravar('enquetes', lista);
      return id;
    },
    async excluirEnquete(id) {
      gravar('enquetes', ler('enquetes', []).filter((e) => e.id !== id));
      const votos = ler('votos', {}); delete votos[id]; gravar('votos', votos);
      const escalas = ler('escalas', {}); delete escalas[id]; gravar('escalas', escalas);
    },

    async listarVotos(enqueteId) { return Object.values(ler('votos', {})[enqueteId] || {}); },
    async getVoto(enqueteId, pubId) { return (ler('votos', {})[enqueteId] || {})[pubId] || null; },
    async salvarVoto(enqueteId, pubId, dados) {
      const votos = ler('votos', {});
      votos[enqueteId] = votos[enqueteId] || {};
      votos[enqueteId][pubId] = { ...dados, publicadorId: pubId };
      gravar('votos', votos);
    },

    async getEscala(enqueteId) { return ler('escalas', {})[enqueteId] || null; },
    async salvarEscala(enqueteId, dados) {
      const escalas = ler('escalas', {});
      escalas[enqueteId] = dados;
      gravar('escalas', escalas);
    },
  };
}
