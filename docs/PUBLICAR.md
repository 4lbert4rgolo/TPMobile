# Publicar uma versão nova

## Como funciona hoje (pelo GitHub)
O site é publicado sozinho pelo GitHub Actions (`.github/workflows/`):

1. **A cada envio ao GitHub** (qualquer branch), o fluxo **Testes** roda:
   - `npm test` e `npm run verificar` (testes do código e conferência da pasta `public`);
   - os testes das **regras do Firestore** no emulador.
2. **Quando algo entra no `master`** (push ou merge de uma branch), o fluxo **Deploy para o Firebase Hosting** roda os testes de novo e, **só se passarem**, publica o site em https://tpmobile-81727.web.app.

Para acompanhar: no GitHub, aba **Actions**. Verde = deu certo; vermelho = algo falhou e o site **não** foi publicado (o site anterior continua no ar).

### Passo a passo
1. Faça as mudanças numa branch e envie ao GitHub. Espere os **Testes** ficarem verdes.
2. Faça o merge da branch no `master` (pelo GitHub, em *Pull requests*, ou pelo terminal).
3. Se o arquivo `firestore.rules` mudou, publique as regras (passo abaixo).
4. No computador, atualize a sua cópia: `git checkout master` e `git pull`.
5. Abra o site e atualize com **Ctrl+F5**. O app instalado no celular pega a versão nova na próxima abertura com internet.

## Regras do Firestore (publicação à parte)
O GitHub publica só o site. As regras de segurança do banco são publicadas pelo terminal, na pasta do projeto:

```
firebase login
npm run deploy:regras
```

Ou: cole o conteúdo de `firestore.rules` em Firebase Console > **Firestore Database** > **Regras** e clique em **Publicar**.

Faça isso sempre que o `firestore.rules` mudar. A última mudança foi na **v2.9** (perfil antigo `anciao` vale como administrador).

## Publicar pelo terminal (alternativa)
```
firebase login
npm run deploy
```
O `npm run deploy` primeiro **confere** a pasta `public` (se o `index.html` é o do app, se estão todos os arquivos e se a configuração do Firebase está preenchida) e só então publica. Se algo estiver errado, ele avisa e **não publica nada**. Prefira o GitHub: ele também roda os testes.

## Cuidados
- **Não rode `firebase init` de novo.** Ele cria um `public/index.html` de boas-vindas ("Firebase Hosting Setup Complete") e pergunta se pode sobrescrever o seu. Se perguntar "File public/index.html already exists. Overwrite?", responda **N**. O `firebase.json` e o `.firebaserc` já estão prontos.
- Ao criar arquivos novos em `public/js/`, acrescente-os também na lista `ARQUIVOS` do `public/sw.js` e troque a `VERSAO` (ex.: `tpmobile-v2.9` → `tpmobile-v3.0`). Assim o app instalado guarda a versão nova.
- Classes novas do Tailwind só funcionam depois de `npm install` e `npm run css` (o `tailwind.css` é gerado). Sem isso, use classes que já existem no arquivo.

## Se aparecer a página de boas-vindas do Firebase
1. Abra o console do Firebase > **Hosting** > **Histórico de versões** (Release history) e olhe a versão mais recente do domínio `tpmobile-81727.web.app`:
   - **Poucos arquivos (1 ou 2):** foi publicado o modelo do Firebase. Restaure o `public/index.html` do GitHub e publique de novo.
   - **Cerca de 30 arquivos e data de hoje:** o app foi publicado. Atualize com Ctrl+F5 ou teste numa janela anônima.
   - **Versão antiga, de antes das suas mudanças:** a publicação nova não aconteceu. Veja a aba **Actions** do GitHub para achar o erro.
   - **O app aparece mais abaixo na lista:** alguém voltou a uma versão antiga (Rollback). No menu da versão do app, escolha **Rollback** para ela, ou publique de novo.
2. Rode `npm run verificar` na pasta do projeto. Ele diz exatamente o que está errado.
