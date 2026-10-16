# Hub de Links — página pública

Esta pasta contém a página pública de redirecionamento. Cada link usa `?id=...`; a página chama o Apps Script público, registra o clique na planilha vinculada e encaminha a pessoa ao destino.

O painel administrativo é servido separadamente por um web app Apps Script privado. Veja [o guia da migração](../apps-script/README.md).

## URL de um link

Com GitHub Pages publicado em `main /docs`, o formato fica:

```text
https://citrino701.github.io/link-tageado/?id=ID_DO_LINK&utm_source=instagram&utm_medium=social&utm_campaign=NOME_DA_CAMPANHA
```

A página acrescenta idioma, fuso horário, navegador, referenciador e um identificador aleatório armazenado no navegador para contar visitantes únicos. Ela não coleta IP nem pede login.

## Apps Script público

O rastreador público precisa ser implantado para executar como o dono do script e permitir acesso de qualquer pessoa. O endpoint público termina em `/exec`; o URL fica configurado na constante `SCRIPT_URL` deste arquivo.

Os links são gerenciados pelo painel privado, não editando linhas manualmente na planilha central.
