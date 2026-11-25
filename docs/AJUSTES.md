# Histórico de versões do TPMobile

**Versão atual: v3.17 (publicada em 25/11/2026).** As versões aparecem da mais antiga (no começo) para a mais nova (no fim). Os passos "Para publicar" de cada versão já foram feitos; ficam aqui só como registro.

| Versão | Resumo |
|---|---|
| 2.0 | Login, três perfis, enquete configurável e escala automática |
| 2.1 | Correções de tela, sugestão de publicador em Usuários, guia de entrada |
| 2.2 | Gestão de usuários, links pessoais, letras maiores, tela de votar mais simples |
| 2.3 | Ponto de votação por publicador e bloqueios por ponto |
| 2.4 | App instalável (PWA) |
| 2.5 | Lembretes de quem não votou, horários de costume, separador "/" |
| 2.6 | Telefone opcional no cadastro |
| 2.7 | Visual verde e novo ícone |
| 2.8 | Menu hambúrguer, privacidade e retenção de 3 meses, backup, código em módulos, testes no GitHub |
| 2.9 | Perfis Votante / Servo Ministerial / Administrador, escala sem sobrescrita, equilíbrio entre semanas, Minha escala, busca, backup automático no Drive |
| 3.0 | Configuração de pontos; fim do tipo "enquete de evento" |
| 3.1 | Auditoria, aceite de privacidade, reserva e "Preciso trocar", importar publicadores, arquivar enquetes, internet fraca, novo visual da impressão, do Excel e da escala |
| 3.2 | Votação em dois passos: grade única de horários e escolha dos pontos pelo votante |
| 3.3 | Equipes do mesmo gênero (casal é exceção) e par fixo "de preferência" |
| 3.4 | Cada pessoa no máximo uma vez por dia; enviar a escala no grupo como imagem ou PDF |
| 3.5 | Notificações no celular e app Android (.apk) |
| 3.6 | Voto mais simples: sem a opção de reserva ("só se precisar") |
| 3.7 | Rodapé com copyright (e na cor do cabeçalho) |
| 3.9 | Prazo da votação, lembrete na véspera e aviso quando a escala muda |
| 3.10 | Menu novo: barra de botões embaixo, grupos, ícones e contadores de pendência |
| 3.11 | "Avisar no grupo": mensagem curta com prazo e link |
| 3.12 | Tela Início: o que fazer agora, próximo horário, resumo da semana, mural de novidades e atalhos |
| 3.13 | Perfil escolhido no link pessoal; uma linha por pessoa em Usuários; aviso de acesso duplicado |
| 3.14 | Segurança: App Check, CSP, bibliotecas de Excel no próprio site (SheetJS 0.20.3) e regras mais rígidas |
| 3.15 | App Check ligado (Google Cloud Fraud Defense), ainda sem bloquear |
| 3.16 | Abertura mais rápida: Excel carrega só na hora; módulos do Firebase baixados juntos |
| 3.17 | Abertura bem mais rápida: arquivos do app vêm do aparelho, com troca de versão segura |

---

## 2.0 e 2.1 — Ponto de partida (zip TPMobile_879ab0.zip)

O seu zip tinha o código da **versão 2.0** (login, três perfis, enquete configurável e escala automática), com estas personalizações suas, que foram **mantidas**:
- `public/js/firebase-config.js` com o seu `apiKey` e `appId` (o arquivo deste pacote é o seu, sem alteração);
- o ícone azul no `public/index.html`.

O seu `package.json` tinha sido recriado por `npm init`; o deste pacote tem os comandos `npm test`, `npm run css` e `npm run serve`.

### Correções e telas (versão 2.1)
- Abrir o `index.html` com dois cliques deixava a página em "Carregando…". Agora a página explica o motivo e o que fazer (`npm run serve`, Laragon ou o endereço publicado). Se o app não iniciar por outro motivo, aparece um aviso depois de 8 segundos.
- No modo demonstração há o link "Ver a tela de login por e-mail e senha", para ver a tela real.
- Em **Usuários**, se o nome da conta for igual ao de um publicador, o app já sugere a ligação.
- Novos guias: `docs/COMO_ENTRAR.md` (como cada pessoa entra, com texto pronto para o grupo).
- **Publicação pelo GitHub:** nos arquivos `.github/workflows/firebase-hosting-merge.yml` e `firebase-hosting-pull-request.yml` (os seus, gerados pelo Firebase CLI), removi só a linha `npm ci && npm run build`. O projeto não tem `package-lock.json` nem script `build` (o CSS já vai pronto), então essa linha fazia a publicação falhar.

## v2.2 — Usuários, links pessoais e acessibilidade
- **Usuários:** alterar nome, perfil e publicador; **Remover acesso** (ou **Recusar**), **Reativar como votante** e **Excluir registro**. Não deixa remover a si mesmo nem tirar o perfil do único administrador.
- **Links de acesso (aba nova):** um link pessoal por publicador, sem e-mail e sem senha. Botões Copiar, Enviar no WhatsApp, Gerar novo e Revogar.
- **Letras maiores** (hoje fica no ☰ Menu e na tela de entrada), lembrado no aparelho.
- **Tela de votar mais simples:** "Olá, nome!", 2 passos escritos, botão **Copiar para todos os pontos** e aviso verde "Pronto! Seus votos foram salvos".
- **Regras do Firestore** (`firestore.rules`) atualizadas: coleção `convites`, entrada pelo link e perfil `removido`.

## v2.3 — Ponto de votação e bloqueios por ponto
- **Publicador, campo "Onde vota":** "Todos os pontos" (padrão) ou "Somente em" um ou mais pontos. A tabela de publicadores ganhou a coluna **Pontos**.
- **Tela de votar:** a pessoa vê só os pontos dela e a frase "Você vota apenas em …". Quem vota em mais de um ponto tem o filtro **Mostrar** (Todos os pontos ou um só), lembrado no aparelho. O botão "Copiar para todos os pontos" copia só para os pontos dela, e o voto salvo guarda só esses pontos.
- **Escala:** o gerador nunca escala alguém fora do ponto dele. Se um organizador puser a pessoa em outro ponto à mão, aparece o aviso "… está configurado para votar só em …".
- **Bloqueios na enquete:** cada bloqueio agora pode valer para **todos os pontos** ou para **um ponto só**, e pode ser de um horário ou do **dia todo**. Os bloqueios antigos (sem ponto) continuam valendo em todos os pontos.
- O texto do WhatsApp ganhou a seção "Atenção", com os bloqueios e o ponto de cada um.
- Testes: 11 testes do gerador e 66 verificações da interface no navegador (modo demonstração).

### O que foi preciso para atualizar (v2.3)
1. Extraia o zip por cima do projeto. Apague o `favicon.png` antigo da raiz, se ainda existir (o usado é `public/favicon.png`).
2. No console do Firebase, em **Firestore Database > Regras**, cole o conteúdo de `firestore.rules` e publique. Sem isso, os links pessoais e a gestão de usuários não funcionam.
3. Em **Authentication > Método de login**, ative **Anônimo** (necessário para o link pessoal).
4. Publique o site (push para o GitHub ou `firebase deploy --only hosting`) e atualize a página com Ctrl+F5.

### Compatibilidade com os dados que já existiam
- Publicadores sem o campo novo valem para todos os pontos.
- Enquetes e bloqueios antigos continuam como estavam.
- Votos antigos continuam valendo; só deixam de contar os votos em pontos que a pessoa não pode mais votar.

### Arquivos alterados em relação ao zip
- `.github/workflows/firebase-hosting-merge.yml`
- `.github/workflows/firebase-hosting-pull-request.yml`
- `README.md`
- `docs/CONFIGURAR_FIREBASE.md`
- `firestore.rules`
- `package.json`
- `public/css/app.css`
- `public/css/tailwind.css`
- `public/index.html`
- `public/js/app.js`
- `public/js/data.js`
- `public/js/escala.js`
- `tests/escala.test.mjs`

### Arquivos novos (v2.1 a v2.3)
- `docs/AJUSTES.md`
- `docs/COMO_ENTRAR.md`

---

## v2.4 — App instalável
- **Instalar como app** (Android, computador e iPhone): ícone na tela, tela cheia, abertura mais rápida. Botão **📲 Instalar app** (hoje no ☰ Menu) e na tela de entrada; no iPhone mostra o passo a passo.
- **Campo "Recebeu um link pessoal?"** na tela de entrada: cola a mensagem inteira com o link e entra (necessário no app instalado do iPhone, que tem armazenamento próprio).
- O app pede ao navegador para **não apagar o login** guardado quando faltar espaço.
- Arquivos novos: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*` (ícones feitos a partir do seu ícone azul), `docs/APP_INSTALAVEL.md`.
- `firebase.json`: o manifesto também não fica em cache. `scripts/verificar-publicacao.mjs`: confere os arquivos novos antes de publicar.
- Não precisa mexer em regras do Firestore nem em Authentication.

## v2.5 e v2.6 — Lembretes, horários de costume, separador na escala e telefone

**Separador na escala.** Quem está na mesma dupla/trio aparece assim: `Ana / Bruno / Carlos` (tela, impressão e Excel). Para usar "e", troque a constante `SEPARADOR_ESCALA` em `public/js/telaEscala.js` por `' e '`.

**Avisar quem não votou.**
- Aba *Enquetes*: cada enquete aberta mostra "12 de 40 já votaram" e o atalho "ver quem falta e lembrar".
- Aba *Votos*: barra de progresso, botão **Lembrar** em cada pessoa que não votou (abre o WhatsApp com a mensagem pronta; você escolhe o contato e envia) e botão **Lembrar o grupo** (texto pronto com o link geral e quantos faltam, sem citar nomes).
- Se a pessoa tem link pessoal (aba *Links de acesso*, só o administrador enxerga), a mensagem leva o link pessoal; senão, leva o link geral.

**Horários de costume.** Ao salvar o voto, a caixa "Guardar como meu costume" grava os horários por *dia da semana + horário + ponto*. Nas próximas enquetes, quem ainda não votou já encontra tudo marcado com o aviso "Marcamos os seus horários de costume. Confira e salve". Horários bloqueados e dias sem carrinho nunca são marcados. Quem já votou tem o botão "Marcar meus horários de costume".

**Para publicar:** rode `npm run deploy` (site) **e** `npm run deploy:regras` (regras do Firestore, nova coleção `disponibilidadePadrao`). Sem as regras novas, salvar o costume dá erro de permissão (o voto em si continua sendo salvo). Alternativa: copiar o conteúdo de `firestore.rules` em Firebase Console > Firestore > Regras > Publicar.

**Telefone no cadastro (v2.6).** O cadastro do publicador tem o campo opcional "Telefone com WhatsApp" (DDD + número; o 55 do Brasil é acrescentado sozinho). Com telefone, os botões **Lembrar** e **Enviar link** abrem a conversa direto com a pessoa; sem telefone, o WhatsApp deixa você escolher o contato. O "Lembrar o grupo" continua igual. Os telefones ficam no Firestore, visíveis só para os organizadores (e para a própria pessoa), e nunca no código do GitHub.

## v2.7 — Novo visual (verde, como o AlpDesk) e novo ícone

Cores trocadas do azul para o verde do AlpDesk (`#0f7a68` nos botões e cabeçalho, `#0b5f51` nos textos de destaque, `#1eb39a` como realce). Novo ícone: calendário com visto, nos arquivos `public/icons/` (192, 512, maskable, iPhone), `favicon.svg` e `favicon.png`, e também no cabeçalho do app. Quem já instalou o app no celular pode precisar remover e instalar de novo para o ícone da tela inicial mudar.


## v2.8 — Menu hambúrguer, privacidade, backup e código organizado

**Menu hambúrguer.** O botão **☰ Menu** (canto direito do cabeçalho) abre um painel com as seções do seu perfil, "Letras maiores", "Instalar app", "Privacidade e dados" e "Sair". Fecha com o ✕, tocando fora do painel ou com a tecla Esc. O cabeçalho mostra a seção atual.

**Privacidade e dados.** Tela com o que o app guarda, quem vê o quê, por quanto tempo (3 meses) e como pedir correção ou remoção. O prazo fica em `MESES_DE_RETENCAO` (`public/js/retencao.js`).

**Backup e dados antigos (só administrador).**
- *Baixar backup*: arquivo `tpmobile-backup-AAAA-MM-DD.json` com publicadores, enquetes, votos, escalas, costumes e usuários. Links pessoais ficam de fora de propósito (quem tem o link entra no app).
- *Apagar dados antigos*: lista as enquetes que terminaram há mais de 3 meses (nunca as que estão com votação aberta), baixa o backup e só então apaga, depois de confirmar. Nada é apagado sozinho.

**Código separado por área** (`public/js/`): `nucleo.js` (estado e utilidades), `sessao.js` (login e início), `shell.js` (cabeçalho, menu e troca de seção), `votar.js`, `votos.js`, `publicadores.js`, `enquetes.js`, `telaEscala.js`, `usuarios.js`, `links.js`, `dados.js`, `retencao.js`, `instalar.js`, e `app.js` (liga os botões às ações). Nada mudou no funcionamento. Continua sendo uma única página (`index.html`).

**Testes automáticos.** `npm test` roda no GitHub a cada envio e **antes de cada publicação** (se falhar, o site não é publicado). As regras do Firestore têm testes próprios (`npm run test:regras`, precisa de Java), que rodam no GitHub.

**Para publicar:** nada de regras novas. Basta fazer o merge da branch `melhorias-urgentes` no `master`.


## v2.9 — Perfis, escala sem sobrescrita, equilíbrio entre semanas, Minha escala e busca

**Perfis.** Agora são três: **Votante**, **Servo Ministerial** e **Administrador**. O perfil "Ancião" deixou de existir: anciãos têm o mesmo acesso do administrador. Quem estava como "Ancião" passa a valer como Administrador na hora, e o cadastro é regravado como `admin` na primeira vez que um administrador abre a tela **Usuários**. As regras do Firestore aceitam o valor antigo `anciao` como administrador, para ninguém perder acesso no meio da troca.

**Dois organizadores ao mesmo tempo.** A escala ganhou um número de versão. Ao trocar um horário, o app grava só aquele horário em cima da versão que está no banco naquele momento (transação do Firestore): se outra pessoa mudou outro horário, a mudança dela é mantida. Se ela mudou o **mesmo** horário enquanto você editava, nada é apagado: aparece "Fulano mudou este horário enquanto você editava" e a tela mostra a versão nova. "Gerar escala" e "Publicar" só gravam se ninguém mexeu desde que você abriu a escala. Embaixo da escala aparece "Última alteração: nome, data e hora".

**Equilíbrio entre semanas.** Ao gerar a escala, o app olha as últimas 4 escalas (enquetes anteriores que não são rascunho) e dá prioridade a quem participou menos. Cada participação média por escala vale meia participação da semana atual, então o equilíbrio da semana continua mandando e as regras (limite das irmãs, par fixo, trio, ponto de votação) continuam valendo. Pode ser desligado em cada enquete, em *Regras da escala*. Os números ficam em `SEMANAS_EQUILIBRIO` e `PESO_HISTORICO` (`public/js/escala.js`).

**Minha escala.** Nova seção no menu para quem tem o acesso ligado a um publicador (votantes e organizadores). Mostra os próximos horários da pessoa nas escalas publicadas, agrupados por dia, com os companheiros de equipe. Cada horário tem o link **Google Agenda** (bom para Android), e o botão **Levar tudo para o calendário** baixa um arquivo `.ics` (abre direto no Calendário do iPhone), com lembrete 1 hora antes. Os horários que já passaram ficam numa seção recolhida.

**Busca.** Campo de busca nas listas de **Publicadores**, **Usuários** e **Links de acesso**. Não diferencia acento nem maiúscula ("marcia" acha "Márcia") e aceita mais de uma palavra.

**Arquivos novos:** `public/js/busca.js`, `public/js/agenda.js` (regras da Minha escala e do calendário), `public/js/telaMinha.js`, `tests/melhorias.test.mjs`. Também: `scripts/apps-script/` (backup automático no Google Drive, ver o README da pasta).

**Publicação (feita em 18/11/2026):** merge da branch `melhorias-em-breve` no `master` e `npm run deploy:regras` (regras do Firestore com o perfil antigo `anciao` valendo como administrador).

**Depois de publicar:** um administrador abre Menu > Usuários uma vez, para o app regravar os cadastros antigos de "Ancião" como Administrador. Quem já tinha instalado o app no celular recebe a versão nova na próxima abertura com internet.


## v3.0 — Configuração de pontos

**Menu > Pontos** (Servo Ministerial e Administrador; também pelo botão **Configurar pontos** em Enquetes). Lista dos pontos com:
- **Adicionar**, **renomear**, mudar a **ordem** (↑ ↓) e **Remover**;
- **Em uso**: só os pontos em uso vêm marcados numa enquete nova (guardado em `config/geral`, campo `pontosPausados`);
- **Salvar alterações** com confirmação quando há nome trocado ou ponto removido, avisando quem votava só nos pontos removidos (essas pessoas passam a ver todos os pontos).

Trocar o nome de um ponto atualiza o "Onde vota" dos publicadores, os horários de costume e as enquetes **em rascunho**. Enquetes abertas, encerradas ou publicadas continuam com o nome antigo, porque os votos e a escala delas usam o nome do ponto como chave.

**Fim da "enquete de evento".** O botão *Nova enquete de evento* e o campo *Tipo* saíram: semanas com congresso ou assembleia usam a enquete normal, com dias desmarcados e bloqueios. Enquetes antigas do tipo evento continuam aparecendo como "Evento". O editor da enquete não cria mais pontos novos (antes ele os acrescentava sozinho à configuração): isso agora é feito só em Menu > Pontos. O cadastro do publicador oferece só os pontos da configuração.

**Arquivos novos:** `public/js/pontos.js` (regras, testadas em `tests/pontos.test.mjs`) e `public/js/telaPontos.js`. Sem mudança nas regras do Firestore (a configuração já era gravada pelos organizadores).


## v3.1 — Auditoria, privacidade, trocas e novo visual

**Impressão, Excel e escala na tela.** Mesmas cores do app. Impressão: uma folha A4 deitada por ponto, com faixa verde (ponto e período), cabeçalho verde-escuro, horários em verde-claro, textos centralizados, reuniões em bege, "Pregação" em cinza e rodapé com a legenda e a data. Excel: uma aba por ponto no mesmo desenho, com título mesclado e linhas zebradas. As cores do Excel vêm da biblioteca **xlsx-js-style** (carregada pelo jsDelivr depois da SheetJS comum); se ela não carregar, a planilha sai igual, sem cores. A escala na tela ficou centralizada, com cabeçalho verde-escuro.

**Auditoria.** Coleção `auditoria`: cada ação de organizador (gerar, trocar pessoas, publicar, enquetes, votos lançados por outra pessoa, publicadores, importação, pontos, usuários, links, backup, limpeza) e cada aceite de privacidade ou pedido de troca vira um registro com nome, perfil e hora do servidor. Menu > **Auditoria** (administrador) com busca e filtro por área; cada escala tem **Histórico desta escala** (organizadores). Ninguém edita um registro; os com mais de 3 meses saem em "Apagar dados antigos". Regras: cada um registra só em nome próprio (uid e nome conferidos, hora do servidor); votante só registra privacidade e trocas.

**Aceite de privacidade.** No primeiro acesso (conta ou link pessoal), a pessoa lê o aviso e marca "Li e concordo" antes de usar o app. Grava `privacidadeAceitaEm` e `privacidadeVersao` no próprio usuário (a regra só deixa a pessoa mudar esses dois campos). O administrador vê a data em Usuários e em Links de acesso. O aviso agora cita reservas, pedidos de troca, auditoria e o backup no Drive.

**Reserva ("só se precisar").** Na tela de votar, cada horário tem três estados: posso (verde), só se precisar (bege tracejado) e desmarcado. A reserva fica em `reserva` no voto, não entra no gerador e não gera aviso se a pessoa for escalada. Aparece no editor do horário ("reserva neste horário") e na lista de votos.

**Preciso trocar.** Na Minha escala, cada horário futuro tem **Preciso trocar** (motivo opcional). O pedido fica em `enquetes/{id}/trocas`. Na Escala, os organizadores veem **Pedidos de troca** com os substitutos: reservas primeiro, depois quem marcou o horário, ordenados por participações, com aviso de quem está no limite. Um toque troca a pessoa (com o controle de versão da escala), encerra o pedido, registra na auditoria e oferece avisar o substituto pelo WhatsApp. Também dá para dispensar o pedido. A pessoa pode cancelar o próprio pedido.

**Importar publicadores.** Em Publicadores > **Importar**: envia .xlsx/.csv ou cola as linhas da planilha (colunas Nome, Gênero, Telefone, Onde vota, Precisa de trio). A prévia separa quem será cadastrado, quem tem erro (com o motivo e a linha) e quem já existe. Modelo em Excel para baixar.

**Arquivar enquetes.** Enquetes encerradas ou publicadas podem ser arquivadas: saem da lista, da Escala e dos Votos, sem apagar nada. "Mostrar as enquetes arquivadas" traz de volta.

**Internet fraca.** Firestore com cache persistente no aparelho (`persistentLocalCache`); o service worker guarda as bibliotecas (Firebase, Excel, fontes), então o app abre sem internet; voto feito offline fica guardado e é enviado quando a conexão volta; faixa "Sem internet" no topo. Mudanças na escala continuam precisando de internet (usam transação).

**Arquivos novos:** `public/js/relatorios.js`, `auditoria.js`, `telaAuditoria.js`, `trocas.js`, `importar.js`, `tests/v31.test.mjs`; testes novos em `tests-regras/regras.spec.mjs`.

**Para publicar:** merge no `master` e `npm run deploy:regras` (as regras mudaram: auditoria, trocas e aceite de privacidade). Sem as regras novas, o aceite de privacidade falha e ninguém consegue passar da tela de aceite.

## v3.2 — Votação em dois passos (20/11/2026)

- Quem vota em mais de um ponto agora vê **uma grade única de horários** ("Em quais horários posso?") e, logo abaixo, caixinhas **"Onde quero participar?"**. Os horários valem para todos os pontos marcados (posso e reserva).
- O próprio votante escolhe os pontos. O campo "Onde vota" do cadastro continua como **restrição opcional** feita pelo organizador: só aparecem as caixinhas dos pontos liberados.
- Horários bloqueados em um ponto não são copiados para ele.
- Link "Preciso de horários diferentes em um ponto específico" abre a tela antiga, por ponto. Votos antigos com horários diferentes por ponto abrem direto nela, sem perder nada.
- Organizadores continuam vendo os votos separados por ponto. Nenhuma mudança nas regras do Firestore.
- Código novo: `public/js/votoUnico.js` (lógica pura) e `tests/votoUnico.test.mjs`.
- Para publicar: aprovar o merge (o deploy roda os testes antes).


## v3.6 — Voto sem a opção de reserva (22/11/2026)

A opção "só se precisar" (reserva) saiu: agora **um toque marca "posso" e outro toque desmarca**. A legenda da votação, a contagem, a lista de votos, o editor do horário e os substitutos dos pedidos de troca não falam mais em reserva. Substituto sugerido é sempre quem marcou o horário, primeiro quem participou menos.

Votos antigos com reserva: a marcação é ignorada (não conta como "marcou" nem como substituto) e some quando a pessoa salvar o voto de novo. Sem mudança nas regras do Firestore.

## v3.5 — Notificações no celular e app Android (21/11/2026)

**Avisos na barra de notificação** (detalhes em [NOTIFICACOES.md](NOTIFICACOES.md)): nova enquete (todos), "Falta o seu voto" (botão **🔔 Notificar quem falta** na aba Votos), escala publicada (cada escalado recebe os próprios horários), pedido de troca (organizadores) e "Você entrou na escala" (substituto). O toque abre o app na aba certa (`?aba=...`).
- Ativar: faixa "Receber avisos no celular?" na primeira vez ou Menu > **🔔 Avisos no celular** (também desativa). iPhone só com o app na tela de início.
- Como funciona: o app guarda o token do aparelho em `dispositivos` e grava o pedido de aviso em `notificacoes`; o script do Google (`scripts/apps-script/Notificacoes.gs`, no mesmo projeto do backup) envia a cada 5 minutos pela API HTTP v1 do Firebase Cloud Messaging, com a conta dona do projeto (sem chave de servidor e sem plano pago); o `sw.js` mostra a notificação (eventos `push` e `notificationclick`).
- Regras novas no Firestore para `dispositivos` e `notificacoes` (**rodar `npm run deploy:regras`**). Falta colar a chave Web Push em `firebase-config.js` (`chaveNotificacoes`) e ativar o script (`ativarNotificacoes`).
- Pedidos enviados são apagados depois de 30 dias e aparelhos sem uso há 3 meses saem da lista (junto com o backup diário). O backup não inclui `dispositivos`.

**App Android** (detalhes em [APP_ANDROID.md](APP_ANDROID.md)): .apk gerado no PWABuilder (Trusted Web Activity), enviado pelo WhatsApp. O app abre o próprio site, então as atualizações continuam automáticas. O `firebase.json` passou a publicar a pasta `.well-known` (para o `assetlinks.json`, que esconde a barra de endereço).

Testes novos: `tests/notificacoes.test.mjs` e regras em `tests-regras/regras.spec.mjs`.

## v3.4 — Uma vez por dia e escala enviada como imagem ou PDF (21/11/2026)

**Cada pessoa no máximo uma vez por dia.** O gerador não coloca a mesma pessoa em dois horários do mesmo dia, nem em pontos diferentes. Regra nova `regras.umPorDia` (ligada por padrão; desligue em Enquetes > Editar > Regras da escala > "Cada pessoa no máximo uma vez por dia"). Na validação, quem foi colocado duas vezes no mesmo dia num ajuste manual aparece em **vermelho** ("Fulano está mais de uma vez em segunda-feira, 23/11: …"). Os substitutos dos pedidos de troca também não incluem quem já está escalado naquele dia.

**Enviar a escala no grupo.** Os botões de imprimir e Excel deram lugar a:
- **Enviar imagem deste ponto** — uma imagem PNG do ponto aberto.
- **Imagens de todos os pontos** — uma imagem por ponto, todas de uma vez.
- **PDF com todos os pontos** — um PDF, uma página A4 deitada por ponto.

No celular abre a janela **Compartilhar** do aparelho: escolha o WhatsApp e o grupo. No computador (quando o navegador não tem essa janela) os arquivos são baixados, para anexar no WhatsApp Web. A imagem tem o mesmo visual da impressão (faixa verde, cabeçalho escuro, nomes centralizados um embaixo do outro, reuniões em bege, "Pregação" em cinza). **Imprimir** e **Exportar Excel** continuam no botão **Mais**.

Como é feito (`public/js/compartilhar.js`): `planoDaPagina()` calcula a posição de cada texto e retângulo (função pura, testada); `pintar()` desenha num `<canvas>`; o PDF é montado à mão (`pdfDeImagens()`), sem biblioteca, com a imagem JPEG em cada página; `compartilharArquivos()` usa a Web Share API (`navigator.share` com arquivos) e baixa os arquivos quando ela não existe. Funciona sem internet.

Sem mudança nas regras do Firestore. Testes novos em `tests/umPorDia.test.mjs` e `tests/compartilhar.test.mjs`.

## v3.3 — Equipes do mesmo gênero e par fixo "de preferência" (21/11/2026)

**Equipes do mesmo gênero.** O gerador só monta duplas e trios só de irmãos ou só de irmãs. A exceção é o casal com par fixo (basta um dos cadastros apontar para o outro): os dois saem juntos e podem completar um trio com mais alguém. Na validação, uma equipe de irmão com irmã que não são casal aparece em **vermelho** ("Equipe com irmão e irmã que não são casal"). Os substitutos sugeridos nos pedidos de troca também respeitam essa regra. Quem está sem gênero no cadastro não bloqueia.

**Par fixo com três opções** (Regras da escala, no editor da enquete; campo `regras.parFixo`):
- **De preferência com o par** (`preferencia`, padrão): o casal entra como uma unidade sempre que os dois estão livres (marcaram, não estão em outro ponto e não passaram do limite). Se o par não puder, a pessoa entra sozinha e forma equipe com alguém do mesmo gênero. Não mostra aviso de "sem o par".
- **Só com o par** (`sempre`): como era antes. Sem o par, a pessoa fica de fora do horário, e o ajuste manual sem o par mostra o aviso amarelo.
- **Não considerar o par fixo nesta enquete** (`ignorar`).

Enquetes antigas guardavam só `parFixoJunto`: `false` continua valendo como "não considerar"; `true` (que era o padrão) passa a valer como "de preferência".

Sem mudança nas regras do Firestore. Testes novos em `tests/escala.test.mjs`.

## v3.7 — Rodapé com copyright (23/11/2026)

Rodapé no mesmo modelo do AlpDesk: faixa escura com linha verde no topo, "TPMobile © 2026" e "Desenvolvido por Albert Argolo". Aparece na tela de entrada e dentro do app, e não sai na impressão. Fica no `index.html` (um só lugar), com o estilo `.rodape-site` em `app.css`. Sem mudança nas regras do Firestore.

## v3.9 — Prazo da votação, lembrete na véspera e aviso de mudança (25/11/2026)

**Prazo da votação.** No editor da enquete, campo novo **"A votação fecha em"** (data e hora; opcional). Enquete nova já vem com a véspera do primeiro dia às 20h; ao duplicar, o prazo anda 7 dias junto com as datas.
- O votante vê "⏰ A votação fecha domingo, 29/11 às 20h"; o card da enquete e o texto do WhatsApp também mostram o prazo.
- No horário, o app trava a votação na hora e o script do Google muda a enquete para **encerrada** em até 5 minutos, registra no histórico como "TPMobile (automático)" e avisa os organizadores ("10 de 12 votaram. Já dá para gerar a escala").
- A partir das **18h**, quem ainda não votou numa enquete que fecha nas próximas 30 horas recebe "⏰ A votação fecha amanhã às 20h" (uma vez por enquete).
- Reabrir uma votação com o prazo vencido pede para mudar o prazo antes. O organizador continua podendo lançar votos por alguém depois do prazo.
- Guardado na enquete como `prazo` (texto ISO em UTC; `null` = sem prazo). `public/js/prazo.js` tem as contas (testadas).

**Lembrete na véspera.** Todo dia, a partir das 18h, quem está escalado no dia seguinte recebe "🛒 Amanhã você está no carrinho: 06:00 às 08:00 – Bairro Novo, com Ana." Só vale para escalas publicadas.

**Aviso quando a escala muda.** Se um organizador troca alguém num horário de escala **já publicada**, quem entrou recebe "Você entrou na escala: …, com Fulano" e quem saiu recebe "Você não está mais na escala em …". Quem pediu troca também é avisado quando ela é resolvida ("✅ Troca resolvida: Gil entra no seu lugar").

As tarefas automáticas ficam no `Notificacoes.gs`, dentro da mesma rodada de 5 minutos (não precisa de gatilho novo): `encerrarPorPrazo_`, `rotinaDiaria_` (`lembrarVespera_` e `avisarPrazo_`). Para testar o lembrete sem esperar as 18h: executar `testarLembreteVespera`. **Para valer, copie o `Notificacoes.gs` novo para o projeto do Apps Script.** Sem mudança nas regras do Firestore. Testes novos em `tests/prazo.test.mjs`.

## v3.10 — Menu novo (25/11/2026)

- **Barra de botões fixa embaixo** (só no celular): votante tem **Votar · Minha escala · Escala · Menu**; organizador tem **Enquetes · Votos · Escala · Menu**. A tela aberta fica em verde e um pontinho laranja indica pendência. No computador continua só o botão Menu do alto. A barra "Salvar meus votos" fica logo acima dela, e ela não sai na impressão.
- **Menu em grupos**: Para mim, Organizar a semana, Cadastros, Administração, Preferências e Sobre, com **ícone** em cada item.
- **Contadores** (só organizadores): "faltam N" em Votos (enquete aberta), "N troca(s)" em Escala (pedidos abertos na escala publicada) e "N aguardando" em Usuários (só administrador). São atualizados a cada troca de tela, sem atrapalhar se falhar.
- Código: `public/js/menu.js` (grupos, atalhos e contadores, testados em `tests/menu.test.mjs`); desenho em `shell.js`; estilos `.barra-baixo`, `.menu-icone` e `.menu-contador` em `app.css`. Sem mudança nas regras do Firestore.

## v3.11 — "Avisar no grupo" (25/11/2026)

O botão "Texto do WhatsApp" da enquete passou a se chamar **Avisar no grupo** e a mensagem ficou curta: título da enquete, prazo ("Vote até domingo, 29/11 às 20h"), link do app e, se houver, os dias sem carrinho (assembleia, congresso). Dias, horários e pontos não vão mais na mensagem, porque o irmão já vê tudo no app. A janela ganhou o botão **Abrir no WhatsApp**, além de Copiar.

## v3.12 — Tela Início (25/11/2026)

O app passa a abrir na tela **Início** (primeiro botão da barra de baixo e primeiro item do menu):
- **O que fazer agora:** "⏰ Falta o seu voto" com o prazo e o botão **Votar agora**, ou "✅ Você já votou" com **Mudar meu voto**.
- **Seu próximo horário** na escala publicada (dia, horário, ponto e dupla), com atalho para a Minha escala e o pedido de troca.
- **Resumo da semana** (servos e administradores): quantos votaram, votação encerrada esperando a escala, escala publicada com trocas abertas e acessos aguardando aprovação; cada linha leva para a tela certa. Atalhos: Nova enquete, Avisar no grupo, Gerar escala e Enviar escala.
- **Mural de novidades:** servos e administradores escrevem (**+ Escrever**): título, texto e "mostrar até" (opcional, depois some sozinha); podem avisar todos no celular na hora. Mostra as 5 mais recentes, com o selo **Novo** para quem ainda não viu (marca por pessoa, neste aparelho). Editar e apagar ficam registrados no histórico (área "Novidades").
- **Atalhos grandes:** Votar, Minha escala, Escala completa e Avisos no celular.

Código: `public/js/telaInicio.js` (tela), `public/js/novidades.js` (regras do mural, testadas em `tests/novidades.test.mjs`). Coleção nova `novidades` no Firestore com regras próprias: todos com acesso leem; servos e administradores escrevem (**rodar `npm run deploy:regras`**).

## v3.13 — Perfil no link pessoal, sem usuário duplicado (25/11/2026)

**Por que duplicava.** Todo link pessoal criava um usuário **Votante** em cada aparelho que o abria. Quando um administrador promovia a pessoa a Servo em Usuários, só aquele aparelho mudava: o próximo celular (ou o app instalado) criava outro Votante. A tela Usuários mostrava uma linha por aparelho.

**Links de acesso.**
- Coluna nova **Perfil**: antes de tocar em **Gerar link**, escolha Votante, Servo Ministerial ou Administrador. Quem abrir o link já entra com esse perfil, em qualquer aparelho.
- Num link que já existe, trocar o perfil vale na hora para o link e para todos os aparelhos que já entraram por ele. **Gerar novo** mantém o perfil do link antigo.
- Link de **Administrador** pede confirmação (dá acesso a tudo sem senha). O app não deixa tirar o perfil do único administrador.
- Se o publicador **já entra com e-mail e senha**, aparece "Já entra com e-mail (perfil)" e o app pergunta antes de gerar um link (seria um segundo acesso da mesma pessoa). **Gerar links para quem ainda não tem** pula essas pessoas.
- A mensagem do WhatsApp de um link de Servo ou Administrador diz o perfil e reforça que não pode ser encaminhada.

**Usuários.**
- **Uma linha por pessoa:** os aparelhos do mesmo link ficam juntos ("Link pessoal · 3 aparelho(s)"). Salvar, Remover acesso, Reativar e Excluir valem para todos os aparelhos, e o perfil e o nome salvos também vão para o link.
- Se os aparelhos da pessoa estavam com perfis diferentes (as duplicações antigas), a linha avisa: confira o perfil e toque em **Salvar** para igualar tudo.
- Aviso "também entra pelo link pessoal" / "também entra com e-mail" quando a mesma pessoa tem os dois acessos.
- **Unificação automática dos duplicados antigos:** na primeira vez que um administrador abre Usuários ou Links de acesso, o app iguala o perfil de todos os aparelhos de cada link (fica o maior: se um aparelho já tinha sido promovido a Servo, todos viram Servo) e grava esse perfil no link, para o próximo aparelho já entrar certo. Aparelhos com acesso removido continuam removidos. Fica registrado na Auditoria ("Unificou acessos duplicados do link pessoal"). Quem tem conta de e-mail **e** link continua com os dois acessos, só com o aviso.
- **Remover acesso** de quem entra pelo link também desativa o link, para um celular novo não entrar de novo; **Reativar** liga o link de volta como Votante.

**Regras do Firestore:** quem entra pelo link só pode gravar o perfil que o link dá (links antigos, sem o campo, continuam dando Votante). Teste novo em `tests-regras/regras.spec.mjs`.

Código: `public/js/acessos.js` (regras puras: perfil do link, agrupar aparelhos, contas de e-mail do publicador), testado em `tests/acessos.test.mjs`; mudanças em `links.js`, `usuarios.js`, `data.js` (`atualizarConvite` e perfil vindo do link) e `firestore.rules`.

**Para publicar:** merge no `master` **e `npm run deploy:regras`** (sem as regras novas, um link de Servo ou Administrador dá erro de permissão ao entrar). Depois, um administrador abre Menu > Usuários uma vez: os duplicados são unificados sozinhos.

## v3.14 — Reforço de segurança (25/11/2026)

Nada muda na tela para os irmãos. Detalhes e passo a passo em [docs/SEGURANCA.md](SEGURANCA.md).

- **App Check (reCAPTCHA v3, invisível):** o app prova para o Firebase que é o TPMobile de verdade. Só liga quando a chave for colada em `chaveAppCheck` (`firebase-config.js`); a aplicação (Enforce) é feita no console depois de alguns dias olhando as métricas.
- **Política de conteúdo (CSP)** e `Permissions-Policy` nos cabeçalhos do site (`firebase.json`): o navegador só roda scripts do próprio site, do Firebase e do reCAPTCHA. O script de "o app não conseguiu iniciar" saiu de dentro do `index.html` para `js/falha-inicio.js`.
- **Bibliotecas de Excel no próprio site:** saem do cdnjs/jsdelivr e passam para `public/vendor`, copiadas do npm por `scripts/copiar-bibliotecas.mjs` (roda sozinho no `npm install` e no deploy do GitHub). A **leitura** de planilhas (importar publicadores) usa a SheetJS **0.20.3**, que corrige as falhas da 0.18.5; a xlsx-js-style continua só para **gerar** a escala em Excel e o modelo.
- **Regras do Firestore mais rígidas:**
  - voto do votante: só os campos do voto (`disponibilidade`, `nome`), com tamanho limitado;
  - pedido de troca do votante: só os campos do pedido, motivo até 200 letras (também ao pedir de novo);
  - auditoria: o perfil gravado tem de ser o perfil real de quem fez; textos com limite;
  - aviso de pedido de troca: um por pedido (id `troca~enquete~pedido~criadoEm`, conferido pelas regras), sem avisos repetidos.
  Testes novos em `tests-regras/regras.spec.mjs` e `tests/notificacoes.test.mjs`.

**Para publicar:** merge no `master` (o deploy do GitHub instala e copia as bibliotecas) **e `npm run deploy:regras`**. No seu computador, rode `npm install` uma vez depois do `git pull` (cria `public/vendor`). Para ativar o App Check, siga o docs/SEGURANCA.md.

## v3.15 — App Check ligado (25/11/2026)

- Chave de site do App Check preenchida em `firebase-config.js` e app registrado no Firebase (App Check > Apps > TPmobile: **Registrado**).
- O provedor passou a ser o **Google Cloud Fraud Defense** (antigo reCAPTCHA Enterprise, `ReCaptchaEnterpriseProvider`), porque o reCAPTCHA clássico foi descontinuado.
- O Cloud Firestore continua **Não aplicado**: por enquanto o App Check só mede. Aplicar depois de alguns dias, conforme o docs/SEGURANCA.md.

## v3.16 — Abertura mais rápida (25/11/2026)

Depois da v3.14 o app ficou mais lento para abrir: a biblioteca de Excel (415 KB) era baixada em todo carregamento, antes de o app começar.
- A biblioteca de Excel agora carrega **só quando alguém gera uma planilha** (escala em Excel ou modelo de importação), pela função `carregarExcel()` em `js/nucleo.js`.
- O módulo do App Check é baixado junto com os outros módulos do Firebase, e não depois deles.

## v3.17 — Abertura bem mais rápida (25/11/2026)

Medição no site (v3.16): uns 2,3 s só para baixar os ~38 arquivos do app, porque o service worker buscava cada um na internet a cada abertura, numa cadeia (um arquivo puxa o outro).
- **Arquivos do app vêm do aparelho:** ao instalar uma versão, o service worker baixa todos os arquivos de uma vez para uma "gaveta" com o nome da versão; ao abrir, usa essa gaveta (no teste: 38 arquivos em ~0,2 s). Nunca mistura arquivo novo com antigo.
- **Versão nova chega sozinha:** o navegador confere se há versão nova; se houver, baixa inteira em segundo plano e o app **recarrega sozinho** quando isso acontece nos primeiros 20 s (e a pessoa não está digitando nem com uma janela aberta); senão, aparece na próxima abertura.
- **Nome da versão automático:** o deploy do GitHub troca `VERSAO` no `sw.js` pelo código do commit, então toda publicação gera uma versão nova, mesmo se alguém esquecer de mudar.
- **Conferência antes de publicar:** `npm run verificar` agora confere que todo arquivo de `public/js` está na lista do `sw.js` e que todos os arquivos da lista existem (se faltar um, a versão nova não instalaria).
- As três primeiras buscas no banco (configuração, enquetes e publicadores) agora vão juntas.
