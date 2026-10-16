# Página ponte do Hub de Links

Esta pasta é a página pública genérica de redirecionamento. Cada clique chega com um `id`; a página chama o Apps Script, que consulta a aba `Links`, registra os dados do clique e devolve o destino.

## Configuração

1. No Apps Script, implante o código do rastreador como **App da Web**:
   - Executar como: **você** (a conta dona das planilhas).
   - Quem pode acessar: **qualquer pessoa**, inclusive sem login.
2. Copie o URL de produção terminado em `/exec`. Não use o URL de teste `/dev`.
3. Edite `index.html` e troque `COLE_AQUI_O_URL_EXEC_DO_APPS_SCRIPT` pelo URL de produção.
4. Depois que esta alteração estiver na branch publicada pelo Pages, abra a página com `?id=...` para testar.

A página não armazena segredo. O endpoint é público por desenho: os visitantes precisam conseguir abrir os links sem entrar na Conta Google. Não coloque credenciais OAuth ou tokens nesta pasta.

## Registro central

Rode `setupTracker()` uma vez no editor do Apps Script. Abra a planilha central criada por essa função e cadastre cada link como uma linha na aba `Links`:

| Coluna | O que preencher |
| --- | --- |
| `id` | Identificador único, por exemplo `campanha01` |
| `nome` | Nome que ajude você a reconhecer o link |
| `campanha` | Nome da campanha |
| `spreadsheetId` | ID ou URL da planilha que receberá os cliques |
| `aba` | Aba de destino; use `Cliques` ou outro nome |
| `destinoUrl` | Página final começando com `https://` ou `http://` |
| `ativo` | `TRUE` para habilitar; `FALSE` para pausar |

O Apps Script cria a aba de cliques de destino e os cabeçalhos quando necessário. A conta dona do script precisa ter acesso de edição a cada planilha de destino.

## Criar e testar um link

Com GitHub Pages publicado a partir de `main /docs`, o formato será:

```text
https://citrino701.github.io/link-tageado/?id=campanha01&utm_source=instagram&utm_medium=social&utm_campaign=campanha01
```

Os parâmetros `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` e `utm_term` são registrados na planilha. Cada link pode apontar para uma planilha, aba e destino diferentes por meio de sua linha na aba `Links`.

Faça o primeiro teste usando uma planilha de teste e um destino que você controla. Confirme que apareceu uma linha em `Cliques` antes de distribuir um link de campanha.

## Limites

Este MVP não depende de Cloud Run, Firestore nem da tela de branding de um cliente OAuth externo. O Apps Script não anuncia um teto de 500 cliques por mês; ele tem cotas diárias, limite de 6 minutos por execução e limite de execuções simultâneas. Ao atingir uma cota, uma execução pode falhar até a cota resetar. Veja as [cotas oficiais do Apps Script](https://developers.google.com/apps-script/guides/services/quotas).

A aba `Links` é a interface administrativa deste primeiro MVP. O app do AI Studio continua no repositório, mas esta página ponte não usa a API Express/Firestore dele.
