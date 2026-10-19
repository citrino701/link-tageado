# Ativar o redirecionamento rápido no Cloudflare Pages

Links novos e links já sincronizados continuam com o mesmo formato curto (`?id=...`). O middleware do Cloudflare consulta o destino no KV e responde com redirecionamento HTTP 302, sem carregar a página intermediária e sem esperar o Apps Script gravar na planilha. O Apps Script continua recebendo e gravando cada clique em segundo plano.

Se o KV ou a configuração ainda não estiverem prontos, a página ponte atual continua funcionando e chama o Apps Script como antes.

## Preparar o Cloudflare Pages

1. No projeto Pages `linkshorter`, crie um namespace KV chamado `LINKS`.
2. Em **Settings → Bindings → Add → KV namespace**, adicione o binding com variável `LINKS` apontando para esse namespace.
3. Em **Settings → Variables and Secrets**, configure:
   - `APPS_SCRIPT_URL`: URL `/exec` da implantação pública de rastreamento.
   - `SYNC_TOKEN`: um token longo e aleatório. Cadastre o mesmo valor como propriedade do Apps Script administrativo.
4. Confirme que o **Root directory** do Pages é a raiz do repositório e que o **Build output directory** é `docs`. A pasta `functions` precisa ficar na raiz do projeto Pages.
5. Faça um novo deploy do Pages depois de salvar os bindings.

> O segredo `SYNC_TOKEN` não deve ser colocado no repositório. Ele só fica nos secrets do Cloudflare e nas propriedades do Apps Script.

## Preparar o Apps Script administrativo

No projeto Apps Script administrativo, adicione estas propriedades do script:

- `CLOUDFLARE_MANAGE_URL` = `https://linkshorter.pages.dev/api/manage-links`
- `CLOUDFLARE_SYNC_TOKEN` = o mesmo valor configurado como secret `SYNC_TOKEN` no Cloudflare

Depois de atualizar e publicar uma nova versão do `Code.gs`, rode uma vez `syncAllLinksToCloudflare` pelo editor do Apps Script. Isso copia os links já cadastrados para o KV. Links novos, ativados, desativados ou excluídos são sincronizados pelo painel.

## Teste

1. Confirme que o histórico dos links foi sincronizado.
2. Abra um link existente em uma janela anônima. Um link sincronizado deve sair direto para o destino; um link que ainda não está no KV continua usando a página ponte.
3. Confira se o clique apareceu uma única vez na planilha da campanha.
4. Crie um link de teste no painel, abra-o e confirme o destino e o registro na planilha.

No plano gratuito, Workers permite até 100 mil requisições por dia, compartilhadas com outros Workers e Pages Functions da conta; KV inclui 100 mil leituras e 1.000 gravações por dia. Cada clique sincronizado consome uma requisição Worker e uma leitura KV; cadastrar, alterar status ou excluir link consome uma gravação KV. Isso não é um teto mensal de 500 cliques. As cotas e a capacidade do Apps Script/Sheets continuam independentes.
