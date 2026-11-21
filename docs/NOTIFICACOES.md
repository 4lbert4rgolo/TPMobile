# Notificações no celular

O TPMobile manda avisos para a barra de notificação do celular:

| Aviso | Quem recebe | Quando |
|---|---|---|
| 🛒 Nova enquete do carrinho (ou "Votação reaberta") | Todos | Quando o organizador abre a votação |
| ⏰ Falta o seu voto | Quem ainda não votou | Quando o organizador toca em **🔔 Notificar quem falta** (aba Votos) |
| 📅 Escala publicada | Todos; quem está escalado recebe os próprios horários | Quando a escala é publicada |
| 🔁 Pedido de troca | Organizadores | Quando alguém toca em **Preciso trocar** |
| 🛒 Você entrou na escala | O substituto escolhido | Quando o organizador resolve o pedido de troca |

Tocar no aviso abre o app direto na aba certa (Votar, Minha escala ou Escala).

## Para cada irmão
- Na primeira vez aparece a faixa **"Receber avisos no celular?"**: toque em **Ativar** e depois em **Permitir**.
- Depois: **☰ Menu > 🔔 Avisos no celular** (ativar, ver se está ativo ou desativar).
- **Android:** funciona no Chrome e no app Android do TPMobile.
- **iPhone:** só com o app instalado na tela de início (Safari > Compartilhar > Adicionar à Tela de Início), iOS 16.4 ou mais novo.
- Os avisos levam até **5 minutos** para chegar (o script confere a cada 5 minutos).
- Quem não ativar continua recebendo pelo WhatsApp, como hoje.

## Configuração (administrador, uma vez só)

### 1. Gerar a chave de notificações no Firebase
1. Abra https://console.firebase.google.com e entre no projeto **tpmobile-81727**.
2. Engrenagem ⚙️ > **Configurações do projeto** > aba **Cloud Messaging**.
3. Em **Configuração da Web** > **Certificados push da Web**, clique em **Gerar par de chaves**.
4. Copie a chave que aparece (um texto comprido começando com "B").
5. Cole no arquivo `public/js/firebase-config.js`, em `chaveNotificacoes = '...'` (ou mande a chave para o Claude colar e publicar). Essa chave é pública, pode ficar no código.

> Se em **Cloud Messaging** aparecer que a **API Firebase Cloud Messaging (V1)** está desativada, clique nos três pontinhos ao lado e em **Gerenciar API no Console do Google Cloud** > **Ativar**.

### 2. Publicar as regras do Firestore
As coleções novas `dispositivos` e `notificacoes` têm regras próprias. No computador, na pasta do projeto:
```
npm run deploy:regras
```

### 3. Ligar o envio no script do Google (o mesmo do backup)
1. Abra https://script.google.com e o projeto **TPMobile Backup**.
2. No arquivo `appsscript.json`, troque o conteúdo pelo do arquivo `scripts/apps-script/appsscript.json` (tem uma permissão nova: `firebase.messaging`).
3. Clique em **+** (Adicionar arquivo) > **Script**, chame de `Notificacoes` e cole o conteúdo de `scripts/apps-script/Notificacoes.gs`.
4. Troque também o `Codigo.gs` pelo novo (ele passou a apagar avisos antigos junto com o backup).
5. Salve (Ctrl+S). Escolha a função `ativarNotificacoes` e clique em **Executar**. O Google pede para autorizar de novo, por causa da permissão nova: autorize.
6. No seu celular, ative os avisos (Menu > Avisos no celular). Volte ao script, escolha `testarNotificacao` e clique em **Executar**: deve chegar "✅ Teste do TPMobile".

Para desligar o envio: execute `desativarNotificacoes`.

## Se não chegar
- **Registro de execução** do script (menu Execuções, à esquerda) mostra cada envio: "Aviso "...": 5 enviado(s), 0 falha(s)".
- `403 ... PERMISSION_DENIED` ou "API has not been used": ative a **Firebase Cloud Messaging API** (passo 1, quadro) e rode de novo.
- `401`: rode qualquer função à mão uma vez e autorize de novo.
- No celular: Configurações > Apps > Chrome (ou TPMobile) > Notificações precisa estar ligado. Modo "Não perturbe" segura os avisos.
- Aparelho que desinstalou o app ou limpou os dados é apagado sozinho da lista no próximo envio.

## Como funciona (para quem quer entender o código)
1. **Ativar** (`public/js/notificacoes.js`): o navegador pede permissão; o Firebase Cloud Messaging (FCM) devolve um **token**, que é o "endereço" daquele aparelho. O app guarda em `dispositivos/{token}` só o token, o `uid` do dono e a plataforma.
2. **Pedir um aviso**: quando algo acontece, o app grava em `notificacoes` um documento com título, texto, aba para abrir e para quem é (`para: { todos }`, `{ organizadores }` ou `{ publicadores: [...] }`). Na escala publicada vai também `porPublicador`, com o texto de cada pessoa escalada.
3. **Enviar** (`scripts/apps-script/Notificacoes.gs`): a cada 5 minutos o script busca os pedidos com `status: "pendente"`, cruza com `usuarios` (perfil e publicador) e `dispositivos`, manda pela API HTTP v1 do FCM usando a conta dona do projeto (sem chave de servidor) e marca o pedido como `enviada`.
4. **Mostrar** (`public/sw.js`): o service worker recebe o evento `push`, mesmo com o app fechado, e mostra a notificação; o toque abre o app na aba certa (`?aba=minha`).

Regras (`firestore.rules`): cada um grava e apaga só o próprio aparelho; ninguém lista aparelhos pelo app. Organizadores pedem qualquer aviso; votante só pede o aviso de troca para os organizadores. Pedidos enviados são apagados depois de 30 dias e aparelhos sem uso há 3 meses saem da lista (no backup diário).
