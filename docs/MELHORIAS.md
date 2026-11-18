# TPMobile — melhorias recomendadas e prioridades

Atualizado em 18/11/2026. Critério: o que protege os dados e a escala vem antes do que só deixa o app mais agradável.

## Já feito

| O quê | Versão |
|---|---|
| Avisar quem ainda não votou (contador, botão Lembrar, lembrete do grupo) | v2.5 |
| Horários de costume (nova enquete já vem marcada) | v2.5 |
| Separador "/" entre as pessoas da escala | v2.5 |
| Telefone opcional no cadastro (Lembrar abre a conversa direto) | v2.6 |
| App instalável (PWA) e link pessoal para votantes | anteriores |

## ⏳ Pronto na branch `melhorias-urgentes`, aguardando publicação (v2.8)

| O quê | Situação |
|---|---|
| Menu hambúrguer no lugar das abas (inclui letras maiores, instalar app, privacidade e sair) | Pronto e testado |
| `app.js` separado em módulos por área (votar, votos, publicadores, enquetes, escala, usuários, links, sessão, menu, dados) | Pronto; 68 verificações de tela continuam passando |
| Aviso de privacidade e retenção de **3 meses** (tela "Privacidade e dados") | Pronto |
| Backup (baixar tudo em um arquivo) e limpeza manual de dados com mais de 3 meses | Pronto, só administrador |
| `npm test` e conferência de publicação antes de cada deploy (GitHub Actions) | Pronto |
| Testes das regras do Firestore no emulador | **Escritos, mas ainda não executados**: rodam no GitHub Actions |

## 🔴 Urgente (faça primeiro)

Todos protegem dados de pessoas ou evitam um erro silencioso. São os de melhor custo-benefício agora.

| # | Melhoria | Por que agora | Esforço |
|---|---|---|---|
| 1 | ✅ escrito, aguardando 1ª execução no GitHub · **Testar as regras do Firestore com o emulador** | As regras mudaram na v2.5 e nunca foram testadas automaticamente. Um erro ali pode expor nomes e telefones ou travar quem vota, sem aviso. | Médio |
| 2 | ✅ feito · **Rodar `npm test` automaticamente a cada envio ao GitHub** | Hoje a publicação não confere nada. Um teste que falha passaria direto para o site. | Pequeno |
| 3 | ✅ feito (3 meses) · **Aviso de privacidade e regra de retenção** | O app agora guarda telefones, além de nomes. Vale definir o que se guarda, quem vê e quando apagar (ex.: apagar votos e escalas com mais de 6 meses). | Pequeno |
| 4 | ✅ feito · **Botão de backup (exportar tudo)** | Os dados só existem no Firebase. Um clique errado de exclusão não tem volta. | Pequeno |

## 🟡 Em breve (próximas 2 a 4 semanas)

Melhoram o uso e a confiança, mas nada quebra se esperarem um pouco.

| # | Melhoria | Observação | Esforço |
|---|---|---|---|
| 5 | **Evitar que dois organizadores se sobrescrevam** | A escala é gravada inteira: se um servo e um ancião editam juntos, o último a salvar apaga a mudança do outro. Sobe de prioridade se vários organizadores começarem a editar a mesma semana. | Médio |
| 6 | **Equilíbrio entre semanas** | Quem participou menos nas últimas semanas tem prioridade. Deixa a escala mais justa. | Médio |
| 7 | **"Minha escala"** | Cada pessoa vê os próprios horários, com opção de levar ao calendário do celular. Ajuda quem tem dificuldade com tecnologia. | Médio |
| 8 | **Busca nas listas** de publicadores e usuários | Ganha valor conforme a lista cresce. | Pequeno |

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

1. Publicar as regras da v2.5 (`npm run deploy:regras`), publicar o visual da v2.7 e fazer um teste real com 2 ou 3 irmãos.
2. Itens 2, 3 e 4 (pequenos, rápidos).
3. Item 1 (regras testadas).
4. Itens 5 a 8, na ordem que a prática mostrar.
5. O resto, quando houver necessidade concreta.

## Fora do TPMobile

- Notificação automática (push): ficou de fora de propósito. O Lembrar por WhatsApp resolve com custo zero. Só vale revisar se o grupo crescer muito.
