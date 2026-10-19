# Ativar o redirecionamento rápido no Cloudflare Pages

Esta atualização faz o navegador pedir o destino à Pages Function. A Function busca o endereço no KV do Cloudflare e devolve o destino sem esperar a gravação na planilha. O Apps Script atual continua registrando os dados do clique em segundo plano. Links que ainda não estiverem no KV continuam usando a ponte atual do Apps Script.

## Preparar o Cloudflare Pages

1. No projeto Pages `linkshorter`, crie um namespace KV chamado `LINKS`.
2. Em **Settings → Functions → KV namespace bindings**, adicione o binding com variável `LINKS` apontando para esse namespace.
3. Em **Settings → Variables and Secrets**, configure:
   - `APPS_SCRIPT_URL`: URL `/exec` da implantação pública de rastreamento.
   - `SYNC_TOKEN`: um token longo e aleatório. Cadastre o mesmo valor como propriedade do script no projeto Apps Script administrativo.
4. Faça um novo deploy do Pages depois de salvar os bindings.

> O segredo `SYNC_TOKEN` não deve ser colocado no repositório. Ele só fica nos secrets do Cloudflare e nas propriedades do Apps Script.

## Preparar o Apps Script administrativo

No projeto Apps Script administrativo, adicione estas propriedades do script:

- `CLOUDFLARE_MANAGE_URL` = `https://linkshorter.pages.dev/api/manage-links`
- `CLOUDFLARE_SYNC_TOKEN` = o mesmo valor configurado como secret `SYNC_TOKEN` no Cloudflare

Depois de atualizar e publicar uma nova versão do `Code.gs`, rode uma vez `syncAllLinksToCloudflare` pelo editor do Apps Script. Isso copia os links já cadastrados para o KV. Links novos, ativados, desativados ou excluídos são sincronizados pelo painel.

## Teste antes de usar

1. Confirme que o histórico dos links existentes foi sincronizado.
2. Abra um link em uma janela anônima. Ele deve redirecionar pelo mesmo destino.
3. Confira se o clique apareceu na planilha da campanha.
4. Se a Function estiver sem configuração ou sem um link sincronizado, a página antiga do Apps Script continua como fallback.

A Pages Function usa uma chamada por abertura de link e o registro no Apps Script ocorre em segundo plano. As cotas próprias do Apps Script continuam se aplicando.
