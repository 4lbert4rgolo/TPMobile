# TPMobile — melhorias recomendadas e prioridades

Atualizado em 18/11/2026 (v2.9). Critério: o que protege os dados e a escala vem antes do que só deixa o app mais agradável.

## Já feito

| O quê | Versão |
|---|---|
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

## ⏳ Para publicar a v2.9

1. Merge da branch `melhorias-em-breve` no `master` (o GitHub testa e publica o site sozinho).
2. `npm run deploy:regras` (regras com o perfil antigo `anciao` valendo como administrador).
3. Teste real com 2 ou 3 irmãos, incluindo a "Minha escala" no iPhone e no Android.

## 🟢 Pode esperar

Úteis, mas não resolvem um problema de hoje.

| # | Melhoria | Observação | Esforço |
|---|---|---|---|
| 9 | **Histórico de quem mudou o quê** (escala e acessos) | Faz mais sentido depois do nº 5 e com mais organizadores. | Médio |
| 10 | **Voto "só se precisar" (reserva) e botão "Preciso trocar"** | Geram lista de substitutos. Dá para continuar combinando no grupo por enquanto. | Médio/Grande |
| 11 | **Importar publicadores em lote** | Útil só no cadastro inicial ou em grandes mudanças. | Pequeno |
| 12 | **Arquivar enquetes antigas** | Só pesa quando a lista de enquetes ficar longa. | Pequeno |
| 13 | **Funcionar melhor com internet fraca** (cópia no aparelho) | Só vale se o sinal for um problema real nos pontos de votação. | Médio |

## Ordem sugerida

1. Publicar a v2.9 e fazer o teste real.
2. Item 9 (histórico de alterações), agora que vários organizadores podem editar ao mesmo tempo.
3. O resto, quando houver necessidade concreta.

## Fora do TPMobile

- Notificação automática (push): ficou de fora de propósito. O Lembrar por WhatsApp resolve com custo zero. Só vale revisar se o grupo crescer muito.
