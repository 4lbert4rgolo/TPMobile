# TPMobile — melhorias recomendadas e prioridades

Atualizado em 18/11/2026, com a v2.9 publicada. Critério: o que protege os dados e a escala vem antes do que só deixa o app mais agradável.

## Já feito

| O quê | Versão |
|---|---|
| Tela Início com mural de novidades escrito pelos servos e administradores | v3.12 |
| "Avisar no grupo" com mensagem curta | v3.11 |
| Menu novo: barra de botões embaixo, grupos, ícones e contadores | v3.10 |
| Prazo da votação, lembrete na véspera (18h) e aviso quando a escala publicada muda | v3.9 |
| Voto mais simples: opção de reserva ("só se precisar") removida | v3.6 |
| Notificações no celular (FCM + script do Google) e app Android (.apk pelo PWABuilder) | v3.5 |
| Uma vez por dia por pessoa; escala enviada no grupo como imagem ou PDF | v3.4 |
| Equipes do mesmo gênero e par fixo "de preferência" | v3.3 |
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

Guardadas em 22/11/2026. Lembrete na véspera, prazo da votação e aviso de mudança foram feitos na v3.9.

| Ideia | Observação |
|---|---|
| Tela "Hoje" | Quem está em cada ponto agora e nos próximos horários. |
| Relatório de participação do mês | Quantas vezes cada um participou, para conversar sobre equilíbrio (planilha ou imagem). |
| Restaurar dados a partir de um backup | O backup diário já está no Drive; restaurar ainda é manual. Botão só para administrador, com prévia. |

## Ordem sugerida

1. Acompanhar o uso do prazo e do lembrete da véspera nas próximas semanas.
2. Avaliar a tela "Hoje" e o relatório do mês.

## Fora do TPMobile

- Notificação automática (push): feita na v3.5.
