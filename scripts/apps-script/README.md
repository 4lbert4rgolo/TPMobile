# Backup automático no Google Drive

Script do Google Apps Script que copia todo o Firestore do TPMobile para a pasta **TPMobile Backups** do seu Google Drive, todo dia entre 3h e 4h. Guarda 90 dias (igual à regra de retenção do app) e deixa de fora a coleção `convites` (links pessoais).

## Como instalar (uma vez)
1. Entre em https://script.google.com com a **mesma conta Google dona do projeto no Firebase** e clique em **Novo projeto**. Dê o nome "TPMobile Backup".
2. Engrenagem (Configurações do projeto) → marque **Mostrar arquivo de manifesto "appsscript.json" no editor**.
3. No editor, cole o conteúdo de `appsscript.json` e de `Codigo.gs` nos arquivos de mesmo nome. Salve (Ctrl+S).
4. Escolha a função `fazerBackup` e clique em **Executar**. Autorize (se aparecer "O Google não verificou este app": Avançado → Acessar). Confira a pasta no Drive.
5. Escolha a função `ativarBackupDiario` e clique em **Executar** (só uma vez).

Para desligar: execute `desativarBackup`. Se uma execução falhar, o Google manda um e-mail avisando.

## O que vai no arquivo
Um `.json` por dia (`tpmobile-backup-AAAA-MM-DD_HH-mm.json`), com todas as coleções do banco do jeito que estão no Firestore: `publicadores`, `enquetes` (com as subcoleções `votos` e `escala` dentro de cada enquete, em `_subcolecoes`), `disponibilidadePadrao`, `config` e `usuarios`. O arquivo tem nomes e telefones: a pasta do Drive deve ficar só com você.

É diferente do botão **Baixar backup** do app (Menu > Privacidade e dados), que gera um resumo organizado para leitura. Os dois servem de cópia de segurança; para restaurar dados a partir de qualquer um deles, peça ajuda: hoje não há um botão de restaurar.

## Como funciona (para quem quer entender o código)
- O script usa a **sua** conta Google (`ScriptApp.getOAuthToken()`): por ser dona do projeto, ela lê o Firestore sem precisar de senha ou chave.
- Lê o banco pela API REST do Firestore, página por página (até 300 documentos por vez), e descobre as subcoleções de cada documento com `listCollectionIds`.
- As configurações (pasta, dias guardados, horário) ficam nas `const` do começo do `Codigo.gs`.
