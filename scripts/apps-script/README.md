# Backup automático no Google Drive

Script do Google Apps Script que copia todo o Firestore do TPMobile para a pasta **TPMobile Backups** do seu Google Drive, todo dia entre 3h e 4h. Guarda 90 dias (igual à regra de retenção do app) e deixa de fora a coleção `convites` (links pessoais).

## Como instalar (uma vez)
1. Entre em https://script.google.com com a **mesma conta Google dona do projeto no Firebase** e clique em **Novo projeto**. Dê o nome "TPMobile Backup".
2. Engrenagem (Configurações do projeto) → marque **Mostrar arquivo de manifesto "appsscript.json" no editor**.
3. No editor, cole o conteúdo de `appsscript.json` e de `Codigo.gs` nos arquivos de mesmo nome. Salve (Ctrl+S).
4. Escolha a função `fazerBackup` e clique em **Executar**. Autorize (se aparecer "O Google não verificou este app": Avançado → Acessar). Confira a pasta no Drive.
5. Escolha a função `ativarBackupDiario` e clique em **Executar** (só uma vez).

Para desligar: execute `desativarBackup`. Se uma execução falhar, o Google manda um e-mail avisando.
