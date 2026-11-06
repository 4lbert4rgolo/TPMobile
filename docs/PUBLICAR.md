# Publicar o app no Firebase Hosting

## Jeito seguro (recomendado)
Na pasta do projeto, no terminal:

```
firebase login
npm run deploy
```

O `npm run deploy` primeiro **confere** a pasta `public` (se o `index.html` é o do app, se estão todos os arquivos e se a configuração do Firebase está preenchida) e só então publica. Se algo estiver errado, ele avisa e **não publica nada**.

Para publicar também as regras de segurança do banco (necessário quando o `firestore.rules` mudar):

```
npm run deploy:regras
```

(ou cole o conteúdo de `firestore.rules` em Firestore Database > Regras no console e clique em Publicar).

## Cuidados
- **Não rode `firebase init` de novo.** Ele cria um `public/index.html` de boas-vindas ("Firebase Hosting Setup Complete") e pergunta se pode sobrescrever o seu. Se perguntar "File public/index.html already exists. Overwrite?", responda **N**. O `firebase.json` e o `.firebaserc` deste projeto já estão prontos.
- Se o endereço mostrar "Firebase Hosting Setup Complete", o que está publicado é o modelo do Firebase e não o app. Veja "Se aparecer a página de boas-vindas" abaixo.
- Depois de publicar, atualize o navegador com **Ctrl+F5**.

## Se aparecer a página de boas-vindas do Firebase
1. Abra o console do Firebase > **Hosting** > **Histórico de versões** (Release history) e olhe a versão mais recente do domínio `tpmobile-81727.web.app`:
   - **Poucos arquivos (1 ou 2):** foi publicado o modelo do Firebase. Restaure o `public/index.html` do zip e rode `npm run deploy`.
   - **Cerca de 8 arquivos e data de hoje:** o app foi publicado. Atualize com Ctrl+F5 ou teste em uma janela anônima.
   - **Versão antiga, de antes das suas mudanças:** a publicação nova não aconteceu. Rode `npm run deploy` ou veja a aba **Actions** do GitHub para achar o erro.
   - **O app aparece mais abaixo na lista:** alguém voltou a uma versão antiga (Rollback). No menu da versão do app, escolha **Rollback** para ela, ou publique de novo.
2. Rode `npm run verificar` na pasta do projeto. Ele diz exatamente o que está errado.
