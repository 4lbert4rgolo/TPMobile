# TPMobile — Gestor de Escalas de Carrinho

App web para montar a escala dos carrinhos do testemunho público, com enquete de disponibilidade, três perfis de acesso e uma escala gerada automaticamente que respeita as regras da congregação.

## Perfis
| Perfil | O que faz |
|---|---|
| Votante | Marca os horários em que pode, em cada ponto, e vê a escala publicada |
| Servo ministerial / Ancião | Cria e configura enquetes, cadastra publicadores, lança votos por outra pessoa, gera e ajusta a escala, publica |
| Administrador | Tudo isso, mais aprovar usuários e definir os perfis |

## Regras da escala
- Equipes normais são **duplas**. Quem "precisa de trio" (idade ou necessidade especial) sempre entra em equipe de **3**.
- Irmãs: máximo de participações por enquete (padrão 3, configurável). Máximo por irmão é opcional.
- Quem tem **par fixo** só participa junto com o par (pode ser desligado em cada enquete).
- Ninguém fica em dois pontos no mesmo horário; só é escalado quem marcou o horário.
- Depois de gerar, é possível trocar as pessoas de qualquer horário; o app avisa se a troca quebra uma regra.
- Cada publicador pode votar em **todos os pontos** ou só em alguns (campo "Onde vota"); a tela de votar mostra só os pontos dele.
- Bloqueios de horário na enquete valem para **todos os pontos** ou só para **um ponto**, e podem ser de um horário ou do **dia todo**.

Lista completa de ajustes e passo a passo para atualizar: [docs/AJUSTES.md](docs/AJUSTES.md).

O site é um **app instalável**: veja [docs/APP_INSTALAVEL.md](docs/APP_INSTALAVEL.md) (como instalar, login no iPhone e o que acontece com o link pessoal).

## Estrutura
```
public/              site (é a pasta publicada no Firebase Hosting)
  index.html
  js/escala.js       regras e gerador da escala (sem tela, testável)
  js/data.js         acesso aos dados: Firebase e modo demonstração
  js/app.js          telas
  js/firebase-config.js   cole aqui apiKey e appId (veja docs/)
  css/tailwind.css   gerado por `npm run css` (já vem pronto)
firestore.rules      regras de segurança do banco
docs/CONFIGURAR_FIREBASE.md   passo a passo da configuração
tests/escala.test.mjs         testes do gerador
```

## Como abrir no computador
O app usa módulos JavaScript, e o navegador **não os carrega quando o arquivo é aberto com dois cliques** (endereço começando com `file://`): a página fica em "Carregando…". Abra sempre por um endereço `http`:
- `npm run serve` e depois http://localhost:8080; ou
- no Laragon, deixe a pasta do projeto em `C:\laragon\www` e abra http://tpmobile.test (o Laragon usa a pasta `public`); ou
- o endereço publicado no Firebase.

## Como cada pessoa entra
Veja [docs/COMO_ENTRAR.md](docs/COMO_ENTRAR.md). O jeito mais fácil é o **link pessoal** (aba *Links de acesso*): a pessoa toca no link recebido no WhatsApp e entra para votar, sem e-mail e sem senha. Também há conta com e-mail e senha. O administrador altera e remove acessos na aba *Usuários*.

## Comandos
- `npm test` roda os testes do gerador (precisa só do Node 18+).
- `npm install` e `npm run css` refazem o CSS depois que você mudar classes em `index.html` ou `app.js`.
- `npm run serve` abre o site em http://localhost:8080 (modo demonstração enquanto o Firebase não estiver configurado).

Passo a passo para ligar ao Firebase: [docs/CONFIGURAR_FIREBASE.md](docs/CONFIGURAR_FIREBASE.md).
