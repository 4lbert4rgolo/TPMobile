# Como ligar o app ao Firebase (uma vez só)

> **Já está feito** para o site https://tpmobile-81727.web.app. Este guia serve para consulta ou para montar o app de novo em outro projeto.

Enquanto isso não for feito, o app abre em **modo demonstração**: funciona, mas os dados ficam só no navegador de quem usa e ninguém consegue votar pelo próprio celular. Depois dos passos abaixo, o login, os votos e as escalas passam a ficar guardados na nuvem e protegidos.

O projeto do Firebase é o mesmo que você já usa: `tpmobile-81727`.

## 1. Ativar o login por e-mail e senha
1. Abra https://console.firebase.google.com e entre no projeto **tpmobile-81727**.
2. Menu **Build > Authentication > Começar**.
3. Aba **Método de login > E-mail/senha > Ativar > Salvar**.
4. Na mesma lista, ative também **Anônimo > Ativar > Salvar**. É o que permite entrar pelo **link pessoal** (veja `docs/COMO_ENTRAR.md`). Ninguém vota anonimamente: o link liga a pessoa ao nome dela na lista.

## 2. Criar o banco de dados
1. Menu **Build > Firestore Database > Criar banco de dados**.
2. Escolha o local **southamerica-east1 (São Paulo)**.
3. Escolha **Modo de produção** (o acesso será controlado pelas regras do passo 3).

## 3. Publicar as regras de segurança
1. Em **Firestore Database > aba Regras**, apague tudo o que estiver lá.
2. Cole o conteúdo do arquivo `firestore.rules` deste projeto.
3. Clique em **Publicar**.

> Estas regras é que protegem os dados. Sem elas, qualquer pessoa com o endereço do app poderia ler a lista de nomes.

## 4. Copiar a configuração do app Web
1. Clique na engrenagem **Configurações do projeto > Geral > Seus apps**.
2. Se ainda não houver um app Web, clique no ícone `</>` e registre com o nome **TPMobile** (não precisa marcar o Hosting).
3. Copie os valores **apiKey** e **appId**.
4. Abra `public/js/firebase-config.js` e cole nos campos `apiKey` e `appId`.

Esses valores só identificam o projeto, podem ficar no código. Quem protege os dados é o login e as regras.

## 5. Publicar o site
Faça o commit e o push para o GitHub (branch `master`). O fluxo `.github/workflows/deploy.yml` roda os testes e publica no Firebase Hosting. Ele usa o segredo `FIREBASE_SERVICE_ACCOUNT_TPMOBILE_81727` do repositório (criado pelo `firebase init hosting:github`).
Se preferir, pelo terminal: `npm run deploy`. Detalhes em [PUBLICAR.md](PUBLICAR.md).

## 6. Criar o primeiro administrador
O primeiro administrador precisa ser definido à mão, uma única vez:
1. Abra o site, clique em **Criar conta** e cadastre-se.
2. No console: **Firestore Database > Dados > coleção `usuarios`** > abra o documento com o seu e-mail.
3. Edite o campo **papel** e troque `pendente` por `admin` (texto, minúsculas). Salve.
4. Saia do app e entre de novo. A seção **Usuários** aparece no ☰ Menu.

## 7. Colocar todo mundo para dentro
1. Cadastre os nomes em Menu > **Publicadores** (nome, gênero, par fixo, "precisa de trio", onde vota e, se quiser, telefone).
2. **Jeito mais fácil (recomendado para quem tem dificuldade com tecnologia):** em Menu > **Links de acesso**, gere um link pessoal para cada publicador e envie pelo WhatsApp. A pessoa só toca no link.
3. **Alternativa:** peça ao irmão que abra o site e **crie a conta** dele com e-mail e senha. Depois, em Menu > **Usuários**, escolha o perfil e **ligue o acesso ao nome** na lista de publicadores:
   - **Votante**: só vota e vê a escala publicada.
   - **Servo Ministerial**: cria e ajusta enquetes, publicadores e escalas. Anciãos recebem o perfil **Administrador**.
   - **Administrador**: tudo isso, mais aprovar pessoas, definir perfis, links de acesso e backup.

## Cuidados com os dados
- A lista de nomes de uma congregação é informação pessoal sensível (a lei de proteção de dados trata crença religiosa como dado sensível). Cadastre só o necessário: nome, gênero, par fixo e "precisa de trio". **Não** registre idade, saúde ou outros detalhes.
- Dê o perfil de organizador (Servo Ministerial ou Administrador) só a quem realmente ajusta a escala.
- Votos e escalas ficam guardados por 3 meses (tela **Privacidade e dados** no menu). O administrador apaga os dados antigos em **Apagar dados antigos**, que baixa um backup antes.
- Instale o **backup automático no Google Drive** ([../scripts/apps-script/README.md](../scripts/apps-script/README.md)): os dados só existem no Firebase.
- O link pessoal funciona como uma chave: quem o tiver entra como aquela pessoa (só para votar e ver a escala). Envie cada link só para a pessoa certa e use **Revogar** se um link vazar.
- Quando alguém sair da congregação, exclua o nome em Publicadores, revogue o link em Links de acesso e use **Remover acesso** em Usuários.
- Em **Authentication > Usuários** você também pode desativar ou excluir contas.
