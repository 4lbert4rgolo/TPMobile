// Configuração do Firebase para este app.
//
// Como preencher (uma vez só):
//   1. Abra https://console.firebase.google.com e entre no projeto "tpmobile-81727".
//   2. Engrenagem > Configurações do projeto > Seus apps > ícone "</>" (Web) > registre o app.
//   3. Copie os valores apiKey e appId e cole abaixo.
//
// Esses valores identificam o projeto e podem ficar no código público; quem protege os dados
// são o login e as regras do arquivo firestore.rules.
//
// Enquanto apiKey e appId estiverem vazios, o app abre em MODO DEMONSTRAÇÃO (dados só neste navegador).

export const firebaseConfig = {
  apiKey: 'AIzaSyAdbE0GVQsslv-KX84woAFpNMJnAHm8kAk',
  authDomain: 'tpmobile-81727.firebaseapp.com',
  projectId: 'tpmobile-81727',
  appId: '1:894151015200:web:ed94f3c79c37b7a0a7f545',
  // Número do projeto (é o número do meio do appId). As notificações precisam dele.
  messagingSenderId: '894151015200',
};

// Chave de notificações (Web Push): Firebase > Configurações do projeto > Cloud Messaging >
// "Certificados push da Web" > Gerar par de chaves. Copie a chave e cole aqui.
// Enquanto estiver vazia, o botão de avisos explica que falta configurar. Veja docs/NOTIFICACOES.md.
export const chaveNotificacoes = 'BKgetvbdMr8uLGAHZVML0SModTRtAJj96OUb23DfVwkB2NV7aBEhaS3JkdcoWlUD22XPrGeZQ4KVGFgb6s_9rGg';

// Chave do App Check (reCAPTCHA v3): prova que quem fala com o banco é o app TPMobile.
// Como criar e ativar: docs/SEGURANCA.md. Enquanto estiver vazia, o app funciona sem App Check.
// Esta chave é pública (fica no navegador de todos); a chave SECRETA do reCAPTCHA vai só no console do Firebase.
export const chaveAppCheck = '';
