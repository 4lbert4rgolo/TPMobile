# Segurança do TPMobile

Resumo de como o app se protege e o que fazer para ativar o App Check.

## Camadas de proteção

| Camada | O que faz | Onde está |
|---|---|---|
| Regras do Firestore | Quem lê e grava cada coisa (o que vale de verdade, no servidor). Votante só vê e grava o que é dele; servo e administrador organizam; só o administrador muda perfis. Campos e tamanhos dos textos conferidos. | `firestore.rules` (testes em `tests-regras/`) |
| Login | E-mail e senha (fica "Aguardando aprovação") ou link pessoal com código de 128 bits que não dá para adivinhar. | `sessao.js`, `links.js` |
| App Check | Só o app TPMobile de verdade consegue falar com o banco (bloqueia programas feitos para mexer por fora). | `data.js`, chave em `firebase-config.js` |
| Política de conteúdo (CSP) | O navegador só roda scripts do próprio site e do Firebase/reCAPTCHA; nada de scripts escritos dentro da página. É uma segunda barreira se algum texto malicioso escapar. | `firebase.json` (cabeçalhos) |
| Bibliotecas no próprio site | As bibliotecas de Excel vêm de `public/vendor` (copiadas do npm), e não de sites de terceiros. A leitura de planilhas usa a SheetJS 0.20.3, sem as falhas da 0.18.5. | `scripts/copiar-bibliotecas.mjs` |
| Textos na tela | Tudo o que alguém digitou passa por `esc()` antes de aparecer (não vira código). | `nucleo.js` |

## App Check (ativado em 25/11/2026)

O reCAPTCHA clássico (v3 com chave secreta) foi descontinuado pelo Google. O TPMobile usa o **Google Cloud Fraud Defense** (antigo reCAPTCHA Enterprise), que pede só a chave do site.

**O que já está feito:**
- Chave criada no reCAPTCHA (projeto do Google Cloud **TPMOBILE**), tipo pontuação, domínios `tpmobile-81727.web.app` e `tpmobile-81727.firebaseapp.com`.
- Firebase > App Check > Apps > TPmobile: **Registrado** com o provedor Fraud Defense (TTL do token: 1 hora).
- `chaveAppCheck` preenchida em `firebase-config.js` (v3.15).
- Custo: até 10.000 verificações por mês sem custo (cada aparelho verifica mais ou menos uma vez por hora de uso).

**O que falta (depois de alguns dias):**
1. Em App Check > **APIs > Cloud Firestore**, olhe as métricas: quase todos os pedidos devem aparecer como **verificados**. Se muita gente ainda estiver com o app antigo aberto, espere mais.
2. Clique em **Aplicar** (Enforce) no Cloud Firestore. A partir daí, pedidos sem App Check são recusados.
3. Logo depois, confira: entrar com e-mail, entrar por um link, votar, o **backup automático no Drive** e as **notificações** (os scripts do Google entram com a sua conta de dono do projeto e não deveriam ser afetados, mas confirme no dia). Se algo parar, em App Check > Cloud Firestore clique em **Desaplicar**.

### Testar no computador (localhost ou Laragon `.test`)

Nesses endereços o reCAPTCHA não funciona, então o app usa um **token de depuração**: na primeira vez, aperte F12 > Console e copie o token que aparece ("App Check debug token: ..."). Cadastre em App Check > Apps > ⋮ > **Gerenciar tokens de depuração**. Não compartilhe esse token.

## Cuidados que dependem de você

- **Conta Google dona do projeto:** é a chave mestra (Firebase, scripts do Google e backup no Drive). Mantenha a verificação em duas etapas ligada.
- **Pasta de backup no Drive:** não compartilhe; tem nomes e telefones.
- **Links de Administrador:** quem tiver o link entra com acesso total, sem senha. Use só quando não houver outro jeito; se vazar, toque em **Revogar** na hora.

## Depois de mudar as regras

`npm run deploy:regras` publica o `firestore.rules`. O deploy do site (GitHub) **não** publica as regras.
