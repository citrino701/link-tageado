# Migração do painel para Apps Script

A interface React continua sendo a do AI Studio, mas passa a ser servida por um web app privado do Apps Script. O Apps Script executa as operações do painel na conta administradora e grava na aba central `Links`. O endpoint público de cliques fica em um segundo projeto Apps Script, acessível sem login, e continua usando a ponte em GitHub Pages.

## Antes de começar

O projeto público já deve ter uma planilha central criada por `setupTracker()`. Copie o ID dessa planilha. O ID está na URL entre `/spreadsheets/d/` e `/edit`.

Após mesclar, aguarde a ação **Build and deploy Link Tageado** terminar em Actions. O workflow gera `docs/app/hub-app.js` e `hub-app.css` e publica o conteúdo de `docs/` no GitHub Pages; o painel privado carrega esses arquivos.

## 1. Atualizar o rastreador público

No projeto Apps Script que já recebe os cliques:

1. Substitua o conteúdo de `Code.gs` pelo arquivo `apps-script/public/Code.gs`.
2. Confirme em **Project Settings → Script Properties** que `TRACKER_REGISTRY_ID` continua apontando para a mesma planilha central.
3. Se o projeto tiver um `appsscript.json` com escopos OAuth declarados manualmente, inclua `https://www.googleapis.com/auth/script.scriptapp`.
4. No editor, rode `setupTracker()` novamente uma vez para autorizar e instalar a tentativa automática da fila a cada 15 minutos. Ela usa `click_id` para não duplicar uma linha durante o reprocessamento.
5. Em **Deploy → Manage deployments**, edite a implantação do app da Web e selecione **New version**. Mantenha **Execute as: Me** e **Who has access: Anyone**.
6. Mantenha o mesmo URL terminado em `/exec`; a página pública usa esse endpoint.

O código acrescenta colunas de visitante/bot às abas de cliques existentes sem apagar as linhas de dados. A aba `Falhas` também ganha campos para permitir tentativas de reprocessamento.

## 2. Criar o painel administrativo privado

Crie um projeto Apps Script separado. Adicione:

- um arquivo de script chamado `Code.gs` com o conteúdo de `apps-script/admin/Code.gs`;
- um arquivo HTML chamado `Admin` com o conteúdo de `apps-script/admin/Admin.html`;
- o manifesto `appsscript.json` com o conteúdo de `apps-script/admin/appsscript.json`.

Para editar o manifesto, habilite **Show "appsscript.json" manifest file in editor settings** nas configurações do projeto.

Em **Project Settings → Script Properties**, adicione:

| Propriedade | Valor |
| --- | --- |
| `TRACKER_REGISTRY_ID` | O ID da mesma planilha central usada pelo rastreador público |
| `ADMIN_EMAIL` | `hugoviajante@gmail.com` |
| `PUBLIC_LINK_BASE_URL` | `https://citrino701.github.io/link-tageado/` |

No editor, selecione `setupAdmin` e clique **Run** uma vez. Autorize o Apps Script a acessar suas planilhas e fazer solicitações externas.

Depois, publique em **Deploy → New deployment → Web app**:

- **Execute as:** User accessing the web app
- **Who has access:** Only myself

Abra o URL `/exec` dessa implantação para usar o painel. O primeiro acesso deve ser feito pela conta indicada em `ADMIN_EMAIL`.

## 3. Publicar os arquivos da interface

Em **GitHub → Settings → Pages → Build and deployment**, selecione **GitHub Actions** como fonte. Não selecione uma branch. O workflow compila a interface, inclui os arquivos gerados em `docs/app/` e publica a pasta `docs/` como artefato do GitHub Pages.

Não é necessário dar ao Actions permissão geral de escrita no conteúdo do repositório. O próprio workflow recebe somente as permissões específicas de publicação do Pages. Alterações em `src/`, `apps-script/` ou `docs/` na branch `main` disparam a compilação e publicação.

## 4. Testar o fluxo

1. Abra o painel administrativo pelo URL privado do Apps Script.
2. Crie um link para uma planilha de teste e confira a linha na aba central `Links`.
3. Copie o link público gerado e abra em uma janela anônima.
4. Confirme que ele redireciona ao destino e cria uma linha em `Cliques`.
5. Confira os cliques, o status do link e a fila de falhas no painel.
6. Use **Sincronizar** no cabeçalho para enviar ao KV os links já cadastrados. Links criados ou editados depois disso sincronizam automaticamente.

Os visitantes não precisam fazer login. Somente a implantação administrativa deve usar **Only myself**; a implantação pública de rastreamento precisa continuar aberta.

## Dados e limites

O Apps Script usa a permissão da conta que abriu o painel. Não há Client ID, Client Secret, refresh token externo ou branding OAuth do Cloud Console. Os cliques são gravados diretamente na planilha de destino; falhas ficam registradas em `Falhas` e podem ser reprocessadas pelo painel quando o evento contém os dados necessários.

Não existe um teto artificial de 500 cliques/mês no código. Cada clique é uma execução separada; o limite de 6 minutos é o tempo máximo de uma execução, não um intervalo entre cliques. Aplicam-se as cotas diárias e de concorrência do Apps Script, sujeitas a mudanças.

## Atualização: campanhas e carregamento do painel

Os novos links compartilhados contêm apenas `?id=...`. O rastreador busca campanha,
origem, meio e conteúdo na planilha central, sem repetir esses textos na URL.
Links antigos com parâmetros `utm_*` continuam aceitos. O painel mostra o endereço
sem `https://`, e o botão **Copiar** mantém a URL completa para compartilhamento.

O formulário oferece **Campanha existente** e **Nova campanha**. Selecionar uma
campanha preenche sua planilha; colar uma planilha cadastrada reconhece o nome da
campanha. O cadastro preserva a aba já usada pelos links anteriores. Quando há
mais de uma associação antiga, o painel pede a escolha da campanha, planilha ou
aba. Uma nova campanha é salva junto com seu primeiro link.

O painel carrega o cadastro antes de consultar o histórico de cliques. Os números
aparecem depois, sem bloquear a seleção de campanhas. Não há alteração de preço
ou inclusão de serviços pagos; continuam valendo as cotas do Apps Script.

Depois de mesclar o PR e concluir o workflow do GitHub:

1. No projeto **administrativo** do Apps Script, substitua `Code.gs` pelo conteúdo
   de `apps-script/admin/Code.gs` deste repositório e salve.
2. Em **Implantar → Gerenciar implantações → Editar (lápis)**, selecione
   **Nova versão → Implantar**. Mantenha a implantação privada e o mesmo URL `/exec`.
3. Reabra o painel. Não é necessário alterar `Admin.html` ou executar o setup novamente.
4. Para aplicar também a redução de leituras no rastreador, atualize `Code.gs` do
   projeto **público** com `apps-script/public/Code.gs` e publique uma nova versão da
   implantação existente. Mantenha o mesmo URL, execução como proprietário e acesso
   público. Não substitua o código de um projeto pelo arquivo do outro.

A interface continua compatível com a API administrativa anterior durante a
atualização, mas o carregamento rápido e a validação no servidor exigem a nova
versão do script administrativo. A abertura do link público continua aguardando
o registro do clique; a latência real depende do Apps Script e deve ser medida
após a publicação. Não há promessa de redirecionamento instantâneo.



## Sincronização, exclusão e identificação de bots

O botão **Sincronizar** no painel administrativo chama o Apps Script para atualizar os links existentes no KV do Cloudflare. Links novos, editados, ativados/desativados e excluídos continuam sendo sincronizados automaticamente. A autorização requer o escopo `script.external_request` no manifesto e as propriedades `CLOUDFLARE_MANAGE_URL` e `CLOUDFLARE_SYNC_TOKEN`.

Ao excluir um link, a linha sai da aba central `Links` e a chave correspondente é removida do KV. A linha completa é guardada na aba `Links_Excluidos` para permitir **Desfazer** no aviso temporário do painel. O histórico de cliques da planilha da campanha é mantido.

A coluna `suspeito_bot` é uma estimativa por sinais observáveis, como user-agent de crawlers conhecidos, requisições `HEAD` e pedidos explícitos de prefetch/preview. Navegação normal no navegador interno do Instagram não é marcada como bot apenas por usar Instagram no user-agent. Nenhuma heurística consegue identificar todos os robôs ou separar com certeza uma pessoa de um clique automatizado: alguns bots imitam navegadores, e alguns previews não se identificam.


## Como interpretar cliques únicos e bots

A contagem de únicos é uma contagem de **navegadores identificados por cookie**, não de pessoas verificadas. O mesmo aparelho pode gerar mais de um identificador se a pessoa trocar de navegador, usar navegação privada ou limpar os dados do site. Sem cookie, não existe uma forma confiável de ligar dois acessos anônimos à mesma pessoa.

O identificador é aleatório e fica no navegador; o sistema não usa IP para deduplicar visitas nem grava o IP bruto na planilha. Assim, celulares diferentes na mesma rede recebem IDs diferentes. IDs antigos com prefixo `edge_`, gerados pelo método que combinava IP e navegador, deixam de entrar na métrica de únicos porque não podem ser separados retroativamente; o total histórico pode cair. A métrica geral do painel soma identificações por link; se o mesmo navegador abrir três links, entra uma vez em cada link. Como o formato longo e o curto usam domínios diferentes, abrir os dois formatos no mesmo navegador pode gerar dois IDs separados.

A detecção de bot também é estimativa: marca user-agents de crawlers conhecidos e sinais como `HEAD` e prefetch/preview. Os cliques são exibidos como humanos estimados quando não há sinal de bot. Para contar pessoas com precisão, exija autenticação ou distribua um código/link individual por participante. Nenhum filtro anônimo promete 100% de certeza.
