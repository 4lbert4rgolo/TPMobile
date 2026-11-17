# Ajustes em relação ao seu zip (TPMobile_879ab0.zip)

O seu zip tinha o código da **versão 2.0** (login, três perfis, enquete configurável e escala automática), com estas personalizações suas, que foram **mantidas**:
- `public/js/firebase-config.js` com o seu `apiKey` e `appId` (o arquivo deste pacote é o seu, sem alteração);
- o ícone azul no `public/index.html`.

O seu `package.json` tinha sido recriado por `npm init`; o deste pacote tem os comandos `npm test`, `npm run css` e `npm run serve`.

## 1. Correções e telas (versão 2.1)
- Abrir o `index.html` com dois cliques deixava a página em "Carregando…". Agora a página explica o motivo e o que fazer (`npm run serve`, Laragon ou o endereço publicado). Se o app não iniciar por outro motivo, aparece um aviso depois de 8 segundos.
- No modo demonstração há o link "Ver a tela de login por e-mail e senha", para ver a tela real.
- Em **Usuários**, se o nome da conta for igual ao de um publicador, o app já sugere a ligação.
- Novos guias: `docs/COMO_ENTRAR.md` (como cada pessoa entra, com texto pronto para o grupo).
- **Publicação pelo GitHub:** nos arquivos `.github/workflows/firebase-hosting-merge.yml` e `firebase-hosting-pull-request.yml` (os seus, gerados pelo Firebase CLI), removi só a linha `npm ci && npm run build`. O projeto não tem `package-lock.json` nem script `build` (o CSS já vai pronto), então essa linha fazia a publicação falhar.

## 2. Usuários, links pessoais e acessibilidade (versão 2.2)
- **Usuários:** alterar nome, perfil e publicador; **Remover acesso** (ou **Recusar**), **Reativar como votante** e **Excluir registro**. Não deixa remover a si mesmo nem tirar o perfil do único administrador.
- **Links de acesso (aba nova):** um link pessoal por publicador, sem e-mail e sem senha. Botões Copiar, Enviar no WhatsApp, Gerar novo e Revogar.
- **Letras maiores** (botão no topo e na tela de entrada), lembrado no aparelho.
- **Tela de votar mais simples:** "Olá, nome!", 2 passos escritos, botão **Copiar para todos os pontos** e aviso verde "Pronto! Seus votos foram salvos".
- **Regras do Firestore** (`firestore.rules`) atualizadas: coleção `convites`, entrada pelo link e perfil `removido`.

## 3. Ponto de votação e bloqueios por ponto (esta versão)
- **Publicador, campo "Onde vota":** "Todos os pontos" (padrão) ou "Somente em" um ou mais pontos. A tabela de publicadores ganhou a coluna **Pontos**.
- **Tela de votar:** a pessoa vê só os pontos dela e a frase "Você vota apenas em …". Quem vota em mais de um ponto tem o filtro **Mostrar** (Todos os pontos ou um só), lembrado no aparelho. O botão "Copiar para todos os pontos" copia só para os pontos dela, e o voto salvo guarda só esses pontos.
- **Escala:** o gerador nunca escala alguém fora do ponto dele. Se um servo ou ancião puser a pessoa em outro ponto à mão, aparece o aviso "… está configurado para votar só em …".
- **Bloqueios na enquete:** cada bloqueio agora pode valer para **todos os pontos** ou para **um ponto só**, e pode ser de um horário ou do **dia todo**. Os bloqueios antigos (sem ponto) continuam valendo em todos os pontos.
- O texto do WhatsApp ganhou a seção "Atenção", com os bloqueios e o ponto de cada um.
- Testes: 11 testes do gerador e 66 verificações da interface no navegador (modo demonstração).

## O que fazer para atualizar
1. Extraia o zip por cima do projeto. Apague o `favicon.png` antigo da raiz, se ainda existir (o usado é `public/favicon.png`).
2. No console do Firebase, em **Firestore Database > Regras**, cole o conteúdo de `firestore.rules` e publique. Sem isso, os links pessoais e a gestão de usuários não funcionam.
3. Em **Authentication > Método de login**, ative **Anônimo** (necessário para o link pessoal).
4. Publique o site (push para o GitHub ou `firebase deploy --only hosting`) e atualize a página com Ctrl+F5.

## Compatibilidade com os dados que você já tem
- Publicadores sem o campo novo valem para todos os pontos.
- Enquetes e bloqueios antigos continuam como estavam.
- Votos antigos continuam valendo; só deixam de contar os votos em pontos que a pessoa não pode mais votar.

## Arquivos alterados em relação ao seu zip
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

## Arquivos novos
- `docs/AJUSTES.md`
- `docs/COMO_ENTRAR.md`

---

## 4. App instalável (versão 2.4)
- **Instalar como app** (Android, computador e iPhone): ícone na tela, tela cheia, abertura mais rápida. Botão **📲 Instalar app** no topo e na tela de entrada; no iPhone mostra o passo a passo.
- **Campo "Recebeu um link pessoal?"** na tela de entrada: cola a mensagem inteira com o link e entra (necessário no app instalado do iPhone, que tem armazenamento próprio).
- O app pede ao navegador para **não apagar o login** guardado quando faltar espaço.
- Arquivos novos: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*` (ícones feitos a partir do seu ícone azul), `docs/APP_INSTALAVEL.md`.
- `firebase.json`: o manifesto também não fica em cache. `scripts/verificar-publicacao.mjs`: confere os arquivos novos antes de publicar.
- Não precisa mexer em regras do Firestore nem em Authentication.

## v2.5 — Lembretes, horários de costume e separador na escala

**Separador na escala.** Quem está na mesma dupla/trio aparece assim: `Ana / Bruno / Carlos` (tela, impressão e Excel). Para usar "e", troque a constante `SEPARADOR_ESCALA` em `public/js/app.js` por `' e '`.

**Avisar quem não votou.**
- Aba *Enquetes*: cada enquete aberta mostra "12 de 40 já votaram" e o atalho "ver quem falta e lembrar".
- Aba *Votos*: barra de progresso, botão **Lembrar** em cada pessoa que não votou (abre o WhatsApp com a mensagem pronta; você escolhe o contato e envia) e botão **Lembrar o grupo** (texto pronto com o link geral e quantos faltam, sem citar nomes).
- Se a pessoa tem link pessoal (aba *Links de acesso*, só o administrador enxerga), a mensagem leva o link pessoal; senão, leva o link geral.

**Horários de costume.** Ao salvar o voto, a caixa "Guardar como meu costume" grava os horários por *dia da semana + horário + ponto*. Nas próximas enquetes, quem ainda não votou já encontra tudo marcado com o aviso "Marcamos os seus horários de costume. Confira e salve". Horários bloqueados e dias sem carrinho nunca são marcados. Quem já votou tem o botão "Marcar meus horários de costume".

**Para publicar:** rode `npm run deploy` (site) **e** `npm run deploy:regras` (regras do Firestore, nova coleção `disponibilidadePadrao`). Sem as regras novas, salvar o costume dá erro de permissão (o voto em si continua sendo salvo). Alternativa: copiar o conteúdo de `firestore.rules` em Firebase Console > Firestore > Regras > Publicar.

**Telefone no cadastro.** O cadastro do publicador tem o campo opcional "Telefone com WhatsApp" (DDD + número; o 55 do Brasil é acrescentado sozinho). Com telefone, os botões **Lembrar** e **Enviar link** abrem a conversa direto com a pessoa; sem telefone, o WhatsApp deixa você escolher o contato. O "Lembrar o grupo" continua igual. Os telefones ficam no Firestore, visíveis só para os organizadores (e para a própria pessoa), e nunca no código do GitHub.
