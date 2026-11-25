// Se o app não iniciar, explica o que fazer em vez de ficar "Carregando…" para sempre.
// Fica num arquivo separado (e não dentro do index.html) por causa da política de segurança (CSP),
// que só deixa rodar scripts vindos de arquivos do próprio site.
(function () {
    function falha(titulo, texto) {
        var app = document.getElementById('app');
        if (!app || !app.querySelector('[data-carregando]')) return;
        app.innerHTML = '<div style="max-width:34rem;margin:3rem auto;padding:1.25rem;background:#fff;border:1px solid #fecaca;border-radius:.75rem;font-family:sans-serif;line-height:1.5">'
            + '<h1 style="font-size:1.1rem;font-weight:700;margin:0 0 .5rem">' + titulo + '</h1>'
            + '<p style="margin:0;color:#334155">' + texto + '</p></div>';
    }
    if (location.protocol === 'file:') {
        falha('Abra pelo endereço do site, não pelo arquivo',
            'Este app não funciona abrindo o index.html direto do computador (endereço começando com file://), porque o navegador bloqueia os scripts. '
            + 'Rode <b>npm install</b> uma vez e depois <b>npm run serve</b>, e abra http://localhost:8080, ou, no Laragon, coloque a pasta do projeto em C:\\laragon\\www e abra http://tpmobile.test, ou use o endereço publicado no Firebase.');
    } else {
        setTimeout(function () {
            falha('O app não conseguiu iniciar',
                'Atualize a página com Ctrl+F5. Se continuar assim, aperte F12, abra a aba Console e envie a mensagem de erro em vermelho.');
        }, 8000);
    }
})();
