# API inicial de contas de clientes

Esta entrega acrescenta rotas protegidas para administrar contas, membros, cotas e criação/listagem de links. Ela não troca ainda o painel Apps Script nem importa a planilha atual. Mantenha o acesso de clientes fechado até concluir a configuração de Cloudflare Access, D1, KV e a tela que consumirá estas rotas.

## Preparação no Cloudflare

1. Aplique em ordem `cloudflare/d1/0001_multi_tenant.sql` e `cloudflare/d1/0002_customer_plans.sql` no banco D1 de teste.
2. No projeto Pages, associe o banco ao binding `DB` e o namespace KV existente ao binding `LINKS`.
3. Configure uma aplicação Cloudflare Access para proteger `/api/*` usando login por e-mail. O Access pode autenticar e-mails, mas a API só libera quem tem associação ativa ou convite no D1.
4. Crie as variáveis do Pages `ACCESS_ISSUER` (URL do seu time Access, por exemplo `https://time.cloudflareaccess.com`), `ACCESS_AUD` (Audience Tag da aplicação) e `PLATFORM_ADMIN_EMAIL` (seu e-mail de administrador geral).
5. Rode os testes e valide com dois e-mails de teste antes de cadastrar um cliente real.

O Cloudflare Access protege `/api/*` e injeta o cabeçalho `Cf-Access-Jwt-Assertion` quando a pessoa já autenticou no navegador. Para chamadas de API fora do navegador, também é aceito `Authorization: Bearer <JWT do Cloudflare Access>`. A API valida assinatura RS256, emissor, audiência e validade do JWT. O e-mail vem do token assinado, nunca de um campo enviado pelo navegador.

## Rotas

- `GET /api/platform/tenants`: só o e-mail em `PLATFORM_ADMIN_EMAIL`; lista clientes, responsáveis, cotas e uso.
- `POST /api/platform/tenants`: só administrador geral; cria uma conta e convida o responsável. Campos: `name`, `ownerEmail`, `linkLimit` (padrão 10) e `planName`.
- `PATCH /api/platform/tenants/:tenantId`: só administrador geral; altera `linkLimit`, `planName` ou `status` (`active`/`suspended`).
- `GET /api/tenants/:tenantId`: dados da conta e uso da cota; requer associação àquele tenant.
- `GET /api/tenants/:tenantId/members`: somente o owner da conta.
- `POST /api/tenants/:tenantId/members`: somente owner; recebe `email` e `role` (`admin`, `editor` ou `viewer`). A pessoa convidada precisa autenticar com esse mesmo e-mail.
- `PATCH /api/tenants/:tenantId/members/:email`: somente owner; altera papel ou estado do membro.
- `DELETE /api/tenants/:tenantId/members/:email`: somente owner; remove a associação.
- `GET /api/tenants/:tenantId/links`: lista somente os links do tenant autenticado.
- `POST /api/tenants/:tenantId/links`: owner/admin/editor cria link. A cota é verificada dentro do `INSERT` no D1 para impedir duas criações simultâneas de ultrapassarem o limite. Links inativos continuam contando.

As operações administrativas e de acesso escrevem no `audit_log`. A remoção de um membro bloqueia as chamadas seguintes. O owner não pode remover a própria conta nem promover alguém a owner pela rota de membros.

## Ainda não incluído nesta fase

- A interface do cliente ainda não chama estas rotas; o painel atual continua usando Apps Script.
- Não há migração dos links, campanhas ou cliques da planilha para D1.
- O cadastro de convite não envia e-mail automaticamente; o owner compartilha o endereço do painel e a pessoa entra com o e-mail convidado.
- Edição, exclusão, gráficos e sincronização completa dos links existentes continuam no fluxo antigo até serem migrados e testados.
- A gravação de cliques para links dos tenants é feita em segundo plano no D1 sem a fila de retry do Apps Script. Se uma gravação falhar, o redirecionamento continua, mas o evento pode faltar nas métricas.

Portanto, esta API é uma fundação funcional e testável, mas não é ainda o ponto para entregar acesso a um cliente em produção.