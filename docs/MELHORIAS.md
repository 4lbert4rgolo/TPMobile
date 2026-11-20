# TPMobile — melhorias recomendadas e prioridades

Atualizado em 18/11/2026, com a v2.9 publicada. Critério: o que protege os dados e a escala vem antes do que só deixa o app mais agradável.

## Já feito

| O quê | Versão |
|---|---|
| Auditoria, aceite de privacidade, reserva e "Preciso trocar", importar publicadores, arquivar enquetes, internet fraca, novo visual da impressão e do Excel | v3.1 |
| Configuração de pontos (Menu > Pontos) e fim da "enquete de evento" | v3.0 |
| Perfis: só Votante, Servo Ministerial e Administrador (anciãos = Administrador) | v2.9 |
| Evitar que dois organizadores se sobrescrevam (versão da escala, troca horário a horário) | v2.9 |
| Equilíbrio entre semanas (últimas 4 escalas, pode desligar por enquete) | v2.9 |
| "Minha escala" com Google Agenda e arquivo de calendário (.ics) | v2.9 |
| Busca em Publicadores, Usuários e Links de acesso | v2.9 |
| Backup automático diário no Google Drive (Apps Script, `scripts/apps-script/`) | v2.9 |
| Menu hambúrguer, `app.js` em módulos, privacidade e retenção de 3 meses, botão de backup | v2.8 |
| Testes automáticos no GitHub antes de cada publicação, inclusive das regras do Firestore no emulador | v2.8 |
| Visual verde e novo ícone | v2.7 |
| Telefone opcional no cadastro (Lembrar abre a conversa direto) | v2.6 |
| Avisar quem não votou, horários de costume, separador "/" | v2.5 |
| App instalável (PWA) e link pessoal para votantes | anteriores |

## ✅ Depois de publicar a v2.9 (18/11/2026)

1. Um administrador abre Menu > **Usuários** uma vez (regrava os antigos "Ancião" como Administrador).
2. Instalar o **backup automático no Google Drive** ([scripts/apps-script/README.md](../scripts/apps-script/README.md)), se ainda não foi feito.
3. Teste real com 2 ou 3 irmãos, incluindo a "Minha escala" no iPhone e no Android, e avisar o grupo sobre a nova seção.

## 🟢 Ideias para depois

Todas as sugestões anteriores foram feitas. Ficam só ideias, para avaliar com o uso:

| Ideia | Observação |
|---|---|
| **Notificações no celular** (barra de notificação) | Nova enquete aberta; lembrete para quem não votou, um dia antes do fim; escala publicada ("você está escalado…"); lembrete na véspera do horário; pedido de troca para os organizadores e aviso ao substituto. Usa o Firebase Cloud Messaging. No Android funciona pelo Chrome; no iPhone só com o app instalado na tela inicial (iOS 16.4 ou mais novo). Envio pelo Google Apps Script (grátis, até ~5 min de atraso) ou por Cloud Functions (na hora, exige o plano Blaze com cartão). |
| **App Android (.apk) fora da Play Store** | Empacotar o site como app Android (Trusted Web Activity, pelo PWABuilder/Bubblewrap ou Android Studio) e enviar o arquivo .apk pelo WhatsApp. O app abre o próprio site, então as atualizações continuam automáticas. Precisa do arquivo `.well-known/assetlinks.json` no site para esconder a barra de endereço; quem instala precisa permitir "fontes desconhecidas". No iPhone não existe esse caminho: continua o app instalável pelo Safari. |
| Prazo da votação | A enquete encerra sozinha na data e hora marcadas. |
| Tela "Hoje" | Quem está em cada ponto agora e nos próximos horários. |
| Restaurar dados a partir de um backup | Hoje o backup só é baixado; restaurar ainda é manual. |
| Relatório de participação do mês | Quantas vezes cada um participou, para conversar sobre equilíbrio. |

## Ordem sugerida

1. Publicar a v3.1 (com `npm run deploy:regras`) e fazer o teste real: aceite de privacidade, reserva e um pedido de troca.
2. Avaliar as ideias acima conforme o uso.

## Fora do TPMobile

- Notificação automática (push): estava fora de propósito; agora está na lista de ideias acima (avaliar depois).
