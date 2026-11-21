# App Android (.apk) do TPMobile

O app Android é o próprio site dentro de uma "casca" Android (chamada **TWA**, Trusted Web Activity). Por isso:
- toda atualização do site já aparece no app, sem gerar um .apk novo;
- login, votos e notificações funcionam igual ao site;
- precisa do **Chrome** instalado no celular (quase todo Android já tem).

No iPhone não existe .apk: lá continua o app instalável pelo Safari (Compartilhar > Adicionar à Tela de Início).

## Gerar o .apk (uma vez, no computador, uns 15 minutos)
1. Abra https://www.pwabuilder.com, cole `https://tpmobile-81727.web.app` e clique em **Start**.
2. Espere a análise e clique em **Package For Stores** > **Android** > **Generate Package**.
3. Na janela de opções, confira:
   - **Package ID:** `app.tpmobile.carrinho` (anote: não dá para mudar depois);
   - **App name:** `Escalas de Carrinho` · **Short name:** `Carrinho`;
   - nas opções avançadas (**All settings**), deixe as **notificações** ligadas ("Notification delegation" / "Enable notifications"): é o que deixa os avisos chegarem pelo app;
   - **Signing key:** **Create new** (deixe o PWABuilder criar a chave).
4. Clique em **Download**. Vem um arquivo .zip. **Guarde esse .zip em lugar seguro** (Google Drive): dentro dele estão a chave de assinatura (`signing.keystore`) e as senhas (`signing-key-info.txt`). Sem ela não dá para atualizar o app depois.
5. Dentro do .zip há o **.apk** (para instalar direto) e o **assetlinks.json**.

## Ligar o app ao site (para esconder a barra de endereço)
Sem este passo o app funciona, mas mostra uma barrinha com o endereço do site no topo.
1. Mande o arquivo **assetlinks.json** do .zip para o Claude (ou coloque em `public/.well-known/assetlinks.json` e faça o commit). O modelo está em `scripts/android/assetlinks.modelo.json`.
2. Depois de publicado, confira abrindo https://tpmobile-81727.web.app/.well-known/assetlinks.json no navegador: tem que aparecer o texto com o Package ID.
3. Feche e abra o app: a barra some.

## Mandar para os irmãos
1. Mande o arquivo `.apk` no grupo do WhatsApp com uma mensagem, por exemplo:
   > Para instalar o app do carrinho no Android: toque no arquivo, toque em **Instalar**. Se aparecer "fontes desconhecidas", toque em **Configurações**, ligue **Permitir desta fonte**, volte e toque em **Instalar**. Depois abra o app, entre com o seu link pessoal e ative os avisos.
2. Quem já usa pelo Chrome continua logado no app (o app usa o mesmo Chrome).
3. O Play Protect pode avisar "app desconhecido": é normal para apps fora da Play Store. Toque em **Instalar mesmo assim**.

## Atualizar o app
Quase nunca é preciso: o app mostra sempre a versão mais nova do site. Só gere um .apk novo se mudar o nome ou o ícone, sempre com a **mesma chave** do .zip guardado (no PWABuilder: Signing key > **Use mine**).
