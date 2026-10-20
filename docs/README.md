# Hub de Links — página pública

Esta pasta contém a página pública de redirecionamento. Cada link usa `?id=...`; a página chama o Apps Script público, registra o clique na planilha vinculada e encaminha a pessoa ao destino.

O painel administrativo é servido separadamente por um web app Apps Script privado. Veja [o guia da migração](../apps-script/README.md).

## URL de um link

Com o workflow publicando o GitHub Pages, o formato do link fica:

```text
https://citrino701.github.io/link-tageado/?id=ID_DO_LINK&utm_source=instagram&utm_medium=social&utm_campaign=NOME_DA_CAMPANHA
```

A página acrescenta idioma, fuso horário, navegador, referenciador e um identificador aleatório salvo no navegador para estimar navegadores únicos. IP não é usado para deduplicar nem gravado na planilha. IDs históricos do método antigo de IP são ignorados na contagem de únicos, pois não é possível recuperar quantos dispositivos eles representavam. O número representa navegadores identificados por cookie, não pessoas; sem cookie, troca de navegador ou limpeza dos dados pode alterar a contagem. Como os formatos curto e completo usam domínios diferentes, abrir ambos pode criar IDs separados.

## Apps Script público

O rastreador público precisa ser implantado para executar como o dono do script e permitir acesso de qualquer pessoa. O endpoint público termina em `/exec`; o URL fica configurado na constante `SCRIPT_URL` deste arquivo.

Os links são gerenciados pelo painel privado, não editando linhas manualmente na planilha central.


## Formato longo

O painel também oferece **Copiar link completo**. Ele usa o endereço público do GitHub Pages e inclui os parâmetros UTM, em vez do domínio curto `linkshorter.pages.dev`. Continua usando a página ponte para registrar e redirecionar o clique; pode demorar mais e plataformas que bloqueiam qualquer redirecionador ainda podem recusá-lo.
