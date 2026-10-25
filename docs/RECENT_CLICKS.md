# Últimos cliques e histórico por link

Os cartões de links e as linhas da visualização em lista mostram os três últimos registros com horário válido, do mais recente para o mais antigo. Cada registro exibe a data/hora no fuso do Apps Script e a classificação existente: **Bot suspeito** ou **Humano (est.)**. A classificação continua sendo uma estimativa.

O resumo acompanha a atualização das métricas, ao abrir ou atualizar o painel. A API administrativa aproveita a mesma leitura de cada planilha/aba usada nos contadores; guarda e devolve no máximo três registros por link. A abertura do catálogo continua sem ler as abas de cliques. Não há consulta individual por cartão nem carregamento dos gráficos na aba Links.

**Ver histórico de cliques** abre a aba Métricas, seleciona o link e sua campanha e posiciona a tela na tabela de histórico. O período inicial é 30 dias, com as opções existentes de 7, 30 ou 90 dias. A tabela mostra até 100 registros do período, incluindo bots suspeitos. Os filtros continuam editáveis.

Ao apagar registros pelo histórico, o painel atualiza também os contadores e os últimos cliques dos cartões. Uma resposta atrasada de outra seleção não substitui o histórico atual.

## Publicação após o merge

1. Aguarde o workflow **Build and deploy Link Tageado** publicar os arquivos da interface no GitHub Pages.
2. No projeto **Apps Script administrativo**, substitua o conteúdo de `Code.gs` pelo arquivo `apps-script/admin/Code.gs` do `main` e salve.
3. Em **Implantar > Gerenciar implantações**, edite a implantação administrativa existente, selecione **Nova versão** e clique em **Implantar**. Preserve o endereço e as configurações de acesso existentes.
4. Reabra/atualize o painel e use **Atualizar** para carregar os últimos cliques.

Esta atualização não exige alterações no manifesto, novas permissões, atualização do rastreador público ou configuração no Cloudflare/D1. Caso o backend administrativo ainda seja o anterior, a interface mostra um aviso de atualização no lugar do resumo.
