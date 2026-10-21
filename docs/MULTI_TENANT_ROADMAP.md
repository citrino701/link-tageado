# Separação de clientes (multi-tenant)

## Objetivo

Manter uma única versão do Hub e uma única publicação, com espaços de dados isolados por cliente. O cliente responsável administra os membros da própria conta. O administrador geral do Hub pode criar, suspender, reativar e prestar suporte a qualquer conta.

## Estado atual verificado

- O painel administrativo usa uma única propriedade TRACKER_REGISTRY_ID para abrir uma planilha central.
- A lista de administradores está no código/configuração do Apps Script, sem cadastro de clientes ou associação por tenant.
- O endpoint inicial do painel entrega os links dessa planilha, sem escopo por cliente.
- O manifesto do painel executa como o usuário que acessa. Isso condiciona quais planilhas cada usuário consegue abrir e as permissões que precisa conceder.
- Portanto, adicionar o e-mail de um cliente à allowlist atual não cria um espaço isolado. Não se deve dar acesso de cliente ao painel atual antes da implementação e dos testes de isolamento.

## Modelo de acesso desejado

- **Administrador geral da plataforma:** os administradores atuais do Hub, provisionados separadamente de contas de cliente. Podem listar e selecionar tenants, suspender/reativar uma conta e consultar os dados para suporte. Todas as ações privilegiadas entram no log de auditoria.
- **Responsável do cliente (owner):** administra os membros da própria empresa, revoga acessos e escolhe os papéis disponíveis para eles. Não pode alterar outros tenants nem conceder papel de administrador geral.
- **Membro:** recebe um papel limitado ao tenant ao qual pertence (por exemplo, editor ou leitor).
- **Tenant suspenso:** login pode ocorrer, mas qualquer operação de dados é negada. Os dados são preservados para reativação ou exportação.

A identidade precisa ser validada no servidor em toda chamada. O servidor obtém o e-mail autenticado, procura associação ativa e aplica o tenant a partir dessa associação. Nunca confiar em um tenant_id enviado apenas pelo navegador.

## Arquitetura alvo

1. **Um frontend** publicado pelo repositório principal.
2. **Uma API no Cloudflare Worker/Pages Functions** para autenticar a identidade, autorizar ações e operar os dados. A API valida a assinatura e o audience do token de identidade em cada chamada; nunca confia somente em um cabeçalho de e-mail.
3. **Cloudflare D1** como cadastro central de tenants, membros, campanhas, links e eventos. Todas as entidades de negócio incluem tenant_id; índices começam por tenant_id para escopo rápido.
4. **Workers KV** permanece como lookup rápido dos links públicos, com chaves que não colidem entre contas. Ele não decide permissões do painel.
5. **Google Sheets por cliente** permanece como opção de exportação/destino de relatório durante a transição. A planilha de um cliente não é usada como cadastro global de todos os clientes. A forma segura de escrever em planilhas de clientes (compartilhamento com uma conta do Hub ou autorização individual) será validada antes de migrar esse fluxo.

Cloudflare Access com OTP por e-mail é um candidato para autenticar pessoas sem pedir acesso ao Apps Script/Sheets. Antes de adotá-lo, um protótipo precisa confirmar o fluxo de convite e remoção feito pelo owner, validação do JWT no Worker, revogação de sessão e configuração que não permita que um usuário sem associação obtenha dados. Apps Script continua ativo até a nova autenticação e leitura/escrita estarem testadas.

## Estrutura inicial D1

O arquivo cloudflare/d1/0001_multi_tenant.sql define os cadastros iniciais:

- tenants: conta do cliente e status;
- tenant_memberships: e-mails, papéis e estado dos membros;
- platform_admins: acesso global, separado das permissões do cliente;
- campaigns, links e clicks: entidades vinculadas ao tenant;
- audit_log: convites, mudanças de papel, suspensões e ações administrativas.

O SQL é somente uma fundação e ainda não deve ser aplicado ao ambiente em produção.

## Migração segura

1. Prototipar autenticação e verificar JWT no Worker. Testar uma pessoa com associação ativa, uma sem associação e uma removida.
2. Implementar API de tenants e membros com autorização server-side e auditoria.
3. Implementar criação de tenants, troca de tenant pelo administrador geral e gerenciamento de membros pelo owner.
4. Adicionar escopo por tenant às rotas de campanhas, links, métricas, exclusão e sincronização com KV. Criar testes negativos de acesso cruzado.
5. Migrar a conta atual para um tenant pessoal e comparar totais de links/cliques com a planilha antiga.
6. Testar um tenant piloto em separado; conferir que não lista, edita, apaga, exporta ou sincroniza dados de outro tenant.
7. Só depois liberar o primeiro cliente e oferecer onboarding replicável. Manter exportação e rollback para o sistema antigo durante a validação.

## Critérios para liberar um cliente

- Um membro do cliente vê apenas seu tenant, mesmo chamando a API manualmente ou alterando parâmetros.
- O owner consegue convidar e remover membro sem intervenção na configuração do GitHub ou do Cloudflare.
- A remoção bloqueia as próximas chamadas e invalida o acesso à sessão conforme o mecanismo de autenticação.
- O administrador geral consegue suspender e reativar tenant sem apagar dados.
- Testes automatizados cobrem isolamento para listagem, leitura, criação, edição, exclusão, métricas, planilhas e sincronização KV.
- O fluxo antigo da conta atual e links públicos existentes continuam funcionando após migração.

## Limites e operação

O modelo centraliza tráfego e armazenamento na conta Cloudflare do Hub. As cotas gratuitas são compartilhadas por todos os clientes; não é correto prometer uso ilimitado. Métricas de consumo e alertas por aproximação da cota são parte do onboarding comercial.

Cobrança, pagamentos, planos e domínios personalizados ficam fora da primeira etapa. Primeiro validamos isolamento, acesso e atualização única do código.
