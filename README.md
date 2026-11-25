# TPMobile — Gestor de Escalas de Carrinho

App web da congregação Parque das Palmeiras para montar a escala dos carrinhos do testemunho público. Os publicadores votam nos horários em que podem, e o app monta a escala sozinho, respeitando as regras da congregação. Depois, os organizadores ajustam a escala e a publicam para todos.

- **Endereço:** https://tpmobile-81727.web.app
- **Versão atual:** v3.15 (App Check ligado; reforço de segurança da v3.14: App Check, política de conteúdo, bibliotecas de Excel no próprio site e regras mais rígidas; veja [docs/SEGURANCA.md](docs/SEGURANCA.md)) (o que mudou em cada versão está em [docs/AJUSTES.md](docs/AJUSTES.md))
- **Tecnologia:** HTML, JavaScript (módulos, sem framework) e Tailwind CSS no navegador; Firebase (Authentication, Firestore e Hosting) como servidor.

## Perfis

| Perfil | O que faz |
|---|---|
| **Votante** | Marca os horários em que pode, em cada ponto, vê a escala publicada e a "Minha escala" e pede troca de um horário |
| **Servo Ministerial** | Tudo do votante, mais: configura os pontos, cria e configura enquetes, cadastra publicadores, lança votos por outra pessoa, lembra quem não votou, gera, ajusta e publica a escala |
| **Administrador** (inclui os anciãos) | Tudo do servo ministerial, mais: aprova usuários, define perfis, gera e revoga os links pessoais, baixa o backup e apaga dados antigos |

Não existe mais o perfil "Ancião": anciãos recebem o perfil **Administrador**. Cadastros antigos com o valor `anciao` valem como administrador e são regravados como `admin` automaticamente.

## O que o app faz

**Para quem vota**
- Entra pelo **link pessoal** (sem e-mail e sem senha) ou com conta de e-mail e senha.
- Vê só os pontos em que pode votar e encontra os **horários de costume** já marcados.
- Um toque marca o horário (**posso**), outro toque desmarca.
- No **primeiro acesso**, confirma que leu o aviso de privacidade (uma vez só).
- Vê a escala publicada, com os próprios horários destacados.
- **Minha escala:** lista os próximos horários da pessoa, com os companheiros de equipe, o link do **Google Agenda** em cada horário e o botão **Levar tudo para o calendário** (arquivo `.ics`, com lembrete 1 hora antes).
- **Preciso trocar:** na Minha escala, pede a troca de um horário (com motivo opcional) e acompanha o pedido.
- **Avisos no celular** (barra de notificação): nova enquete, lembrete de votar, os próprios horários quando a escala é publicada, **lembrete na véspera** (às 18h), mudanças na escala e trocas. Ativa em Menu > 🔔 Avisos no celular.
- **Prazo da votação:** a enquete fecha sozinha na data e hora marcadas; quem não votou recebe um lembrete às 18h da véspera do prazo.
- **Letras maiores**, **app instalável** no celular e **app Android** (.apk enviado pelo WhatsApp).

**Para os organizadores**
- **Pontos** (Menu > Pontos): criar, renomear, reordenar, remover e marcar quais estão **em uso**. Renomear atualiza o "Onde vota" dos publicadores, os horários de costume e os rascunhos.
- **Enquetes** configuráveis: dias, horários, pontos, bloqueios (de um horário ou do dia todo, em todos os pontos ou em um só) e regras da escala. Semanas com evento (congresso, assembleia) usam os dias desmarcados e os bloqueios: não há um tipo separado de enquete.
- **Votos:** quantos já votaram, quem falta, botão **Lembrar** pelo WhatsApp (direto no número, se houver telefone) e **Lembrar o grupo**.
- **Escala automática** com avisos quando uma troca manual quebra uma regra.
- **Dois organizadores ao mesmo tempo:** cada troca grava só aquele horário em cima da versão mais nova do banco. Se outra pessoa mudou o mesmo horário, nada é apagado: o app avisa e mostra a versão nova. A tela mostra quem fez a última alteração.
- **Equilíbrio entre semanas:** quem participou menos nas últimas 4 escalas tem prioridade (pode desligar em cada enquete).
- **Busca** nas listas de Publicadores, Usuários e Links de acesso.
- **Pedidos de troca:** aparecem em destaque na Escala, com os substitutos sugeridos (quem marcou o horário, primeiro quem participou menos). Um toque coloca o substituto no lugar e oferece avisá-lo pelo WhatsApp.
- **Auditoria** (Menu > Auditoria, administrador): quem fez o quê e quando, com busca e filtro por área. Cada escala também tem o seu **Histórico** (organizadores).
- **Importar publicadores** de uma planilha (.xlsx/.csv ou colando as linhas), com prévia e modelo para baixar.
- **Arquivar** enquetes passadas: saem da lista sem apagar nada.
- **Enviar a escala no grupo** como imagem (um ponto ou todos) ou como PDF (uma página por ponto): no celular abre a janela de compartilhar, é só escolher o WhatsApp e o grupo. Mesmo visual da impressão: faixa verde com o ponto e o período, cabeçalho escuro, textos centralizados, reuniões em bege e "Pregação" em cinza.
- Imprimir e exportar para Excel continuam no botão **Mais**.

**Dados e segurança**
- Regras do Firestore (`firestore.rules`) controlam quem lê e grava cada coisa.
- Tela **Privacidade e dados** no menu. Votos e escalas ficam guardados por 3 meses.
- **Baixar backup** (administrador) e **Apagar dados antigos** (sempre baixa o backup antes).
- **Backup automático diário no Google Drive**, por um script do Google Apps Script: veja [scripts/apps-script/README.md](scripts/apps-script/README.md).
- **Aceite de privacidade** guardado com data em cada usuário; o administrador vê quem aceitou em Usuários e em Links de acesso.
- **Internet fraca:** o que já foi aberto continua aparecendo sem internet (cache do Firebase no aparelho), o app abre mesmo offline e o voto feito sem internet é enviado quando a conexão volta. Uma faixa avisa quando a internet cai.

## Regras da escala
- Equipes normais são **duplas**. Quem "precisa de trio" (idade ou necessidade especial) sempre entra em equipe de **3**.
- Irmãs: máximo de participações por enquete (padrão 3, configurável). Máximo por irmão é opcional.
- **Equipes do mesmo gênero:** duplas e trios só de irmãos ou só de irmãs. A exceção é o casal (par fixo), que sai junto e pode completar um trio com mais alguém.
- **Par fixo** (escolhido em cada enquete): **de preferência com o par** (padrão: o casal sai junto sempre que os dois puderem; se o par não puder, a pessoa sai com alguém do mesmo gênero), **só com o par** (sem o par, fica de fora) ou **não considerar**.
- Ninguém fica em dois pontos no mesmo horário; só é escalado quem marcou o horário.
- **Uma vez por dia:** cada pessoa sai no máximo uma vez por dia (pode desligar em cada enquete).
- Cada publicador pode votar em **todos os pontos** ou só em alguns (campo "Onde vota"). O gerador nunca escala alguém fora do ponto dele.
- Os horários com menos voluntários são preenchidos primeiro. Entre os candidatos, tem prioridade quem participou menos nesta escala e, com o equilíbrio ligado, nas 4 anteriores.
- Depois de gerar, dá para trocar as pessoas de qualquer horário; o app avisa se a troca quebra uma regra.

## Documentação

| Documento | Para quê |
|---|---|
| [docs/GUIA_ORGANIZADORES.md](docs/GUIA_ORGANIZADORES.md) | Passo a passo da semana: criar a enquete, acompanhar os votos, gerar, ajustar e publicar a escala |
| [docs/COMO_ENTRAR.md](docs/COMO_ENTRAR.md) | Como cada pessoa entra (link pessoal ou e-mail e senha) e como o administrador cuida dos acessos |
| [docs/APP_INSTALAVEL.md](docs/APP_INSTALAVEL.md) | Instalar no celular, login no iPhone, atualizações |
| [docs/NOTIFICACOES.md](docs/NOTIFICACOES.md) | Avisos no celular: o que chega, como ativar e a configuração (chave e script do Google) |
| [docs/APP_ANDROID.md](docs/APP_ANDROID.md) | Gerar o app Android (.apk) no PWABuilder e mandar pelo WhatsApp |
| [docs/PUBLICAR.md](docs/PUBLICAR.md) | Como publicar uma versão nova (GitHub) e as regras do Firestore |
| [docs/CONFIGURAR_FIREBASE.md](docs/CONFIGURAR_FIREBASE.md) | Configuração inicial do Firebase (já feita; serve para refazer ou consultar) |
| [docs/AJUSTES.md](docs/AJUSTES.md) | Histórico de versões: o que mudou em cada uma |
| [docs/MELHORIAS.md](docs/MELHORIAS.md) | O que já foi feito e as próximas ideias, por prioridade |
| [scripts/apps-script/README.md](scripts/apps-script/README.md) | Backup automático no Google Drive |

## Estrutura do projeto
```
public/                    site (pasta publicada no Firebase Hosting)
  index.html               página única do app
  manifest.webmanifest     dados do app instalável (nome, ícones, cores)
  sw.js                    service worker: guarda a tela no aparelho para abrir mais rápido
  css/tailwind.css         gerado por `npm run css` (já vem pronto)
  css/app.css              estilos próprios (cores, escala, menu)
  icons/                   ícones do app
  js/
    app.js                 liga os botões da tela às ações
    nucleo.js              estado do app e utilidades (avisos, janelas, erros)
    data.js                acesso aos dados: Firebase e modo demonstração; perfis
    firebase-config.js     apiKey e appId do projeto
    sessao.js              login, link pessoal e carregamento inicial
    shell.js               cabeçalho, menu hambúrguer e troca de seção
    votar.js               tela de votar e horários de costume
    votos.js               acompanhamento dos votos e lembretes pelo WhatsApp
    enquetes.js            lista e editor de enquetes
    pontos.js              regras da configuração de pontos (sem tela, testável)
    relatorios.js          texto das células e desenho do Excel com cores (testável)
    compartilhar.js        imagem e PDF da escala para enviar no grupo (testável)
    notificacoes.js        avisos no celular: textos, ativar, desativar (testável)
    prazo.js               prazo da votação: formato, texto e "já passou?" (testável)
    menu.js                grupos do menu, barra de baixo e contadores de pendência (testável)
    telaInicio.js          tela Início: o que fazer agora, próximo horário, resumo e mural
    novidades.js           regras do mural de novidades (testável)
    telaNotificacoes.js    faixa e tela "Avisos no celular"
    auditoria.js           eventos de auditoria: montar, descrever, filtrar (testável)
    telaAuditoria.js       registrar eventos, tela Auditoria e histórico da escala
    trocas.js              pedidos de troca e substitutos (testável)
    importar.js            leitura e validação da importação de publicadores (testável)
    telaPontos.js          tela "Pontos"
    escala.js              regras e gerador da escala, equilíbrio e controle de versão (sem tela, testável)
    telaEscala.js          tela da escala: gerar, ajustar, publicar, enviar, imprimir, Excel
    agenda.js              Minha escala: horários da pessoa, .ics e Google Agenda (sem tela, testável)
    telaMinha.js           tela "Minha escala"
    publicadores.js        cadastro de publicadores
    usuarios.js            usuários e perfis (administrador)
    links.js               links pessoais (administrador)
    busca.js               busca nas listas
    dados.js               privacidade, backup e limpeza de dados antigos
    retencao.js            regra dos 3 meses de retenção (testável)
    instalar.js            botão "Instalar app"
firestore.rules            regras de segurança do banco
tests/                     testes do código (`npm test`)
tests-regras/              testes das regras do Firestore no emulador (`npm run test:regras`)
scripts/verificar-publicacao.mjs   confere a pasta public antes de publicar
scripts/apps-script/       backup automático no Google Drive
.github/workflows/         testes a cada envio e publicação automática do master
docs/                      documentação
```

## Como abrir no computador
O app usa módulos JavaScript, e o navegador **não os carrega quando o arquivo é aberto com dois cliques** (endereço começando com `file://`): a página fica em "Carregando…". Abra sempre por um endereço `http`:
- `npm run serve` e depois http://localhost:8080; ou
- no Laragon, deixe a pasta do projeto em `C:\laragon\www` e abra http://tpmobile.test (o Laragon usa a pasta `public`); ou
- o endereço publicado: https://tpmobile-81727.web.app

Com o `firebase-config.js` preenchido, o app local usa os **dados reais**. Para testar sem mexer nos dados reais, apague temporariamente `apiKey` e `appId` (sem fazer commit): o app abre em **modo demonstração**, com dados de exemplo guardados só no navegador.

## Comandos
| Comando | O que faz |
|---|---|
| `npm test` | Roda os testes do código (gerador, equilíbrio, controle de versão, Minha escala, busca, pontos, relatórios, auditoria, trocas, importação, retenção). Precisa só do Node 18+ |
| `npm run test:regras` | Testa as regras do Firestore no emulador (precisa de Java e `npm install`) |
| `npm run serve` | Abre o site em http://localhost:8080 |
| `npm install` e `npm run css` | Refazem o `tailwind.css` depois de usar classes novas do Tailwind |
| `npm run verificar` | Confere a pasta `public` antes de publicar |
| `npm run deploy` | Confere e publica o site pelo terminal (o normal é publicar pelo GitHub, veja [docs/PUBLICAR.md](docs/PUBLICAR.md)) |
| `npm run deploy:regras` | Publica as regras do Firestore (necessário sempre que `firestore.rules` mudar) |

## Publicação
Cada envio ao GitHub roda os testes. Quando algo entra no branch `master`, o GitHub testa de novo e, se tudo passar, publica o site no Firebase Hosting. As regras do Firestore são publicadas à parte, com `npm run deploy:regras`. Detalhes em [docs/PUBLICAR.md](docs/PUBLICAR.md).
