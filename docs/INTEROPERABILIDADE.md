# Interoperabilidade e verificação independente

O formato exportado é um **perfil retangular, bloqueado e ASCII do IPUZ v2**, com `kind: ["http://ipuz.org/crossword#1"]`. Não implementa todas as variantes do padrão. A fronteira do formato usa as respostas A–Z já confirmadas pelo autor: por exemplo, o original `ação` fica guardado no JSON de autoria e vira `ACAO` na grade do gabarito.

## O que o padrão e o consumidor externo dizem

A [especificação oficial IPUZ v2](https://www.puzzazz.com/ipuz/v2) define o valor padrão zero para célula vazia, `puzzle` como matriz em ordem de linhas e colunas, `solution` como solução e `clues` por direção. `solution` não está entre os campos obrigatórios. Isso sustenta o perfil sem solução; não é promessa de suporte de todo consumidor existente. Título, introdução, autoria e pistas são campos que admitem HTML no padrão. Por isso o aplicativo escapa os textos do autor, inclusive `&` e `<`, antes de escrevê-los no IPUZ. O verificador usa `html.unescape` e também confere o escape canônico exato.

Como confirmação externa concreta, o próprio Exolve tem um [exemplo IPUZ sem solução](https://github.com/viresh-ratnakar/exolve/blob/8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2/test-ipuz-unsolved.html) com células zero e sem campo `solution`, além de um [exemplo com solução](https://github.com/viresh-ratnakar/exolve/blob/8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2/test-ipuz-solved.html). O [conversor oficial](https://github.com/viresh-ratnakar/exolve/blob/8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2/exolve-from-ipuz.js) trata separadamente esses casos e produz zeros na grade Exolve quando `solution` não existe. Esses exemplos externos foram inspecionados como documentação; as cruzadas do aplicativo são originais e não foram copiadas deles.

## Preparar o player oficial, sem incluí-lo no aplicativo

O consumidor externo usado em QA é [Exolve](https://github.com/viresh-ratnakar/exolve), fixado no commit `8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2`, sob [licença MIT oficial completa](https://github.com/viresh-ratnakar/exolve/blob/8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2/LICENSE). A preparação é explícita:

```sh
python3 tools/prepare-exolve.py --download
python3 tools/prepare-exolve.py --verify-local
```

O primeiro comando acessa somente os arquivos oficiais daquele commit e confere os SHA256 fixados no código **antes de aceitar os bytes**. O segundo funciona sem rede. Ambos verificam as dependências declaradas no HTML oficial. Os arquivos são copiados sem alteração para `local/exolve/`, junto de `LICENSE` com o texto integral da licença e `PROVENANCE.json` com repositório, commit, URLs, SHA256, licença e indicação de ausência de patches. Esse diretório local é ignorado pelo Git e pela distribuição estática. Nenhum pacote, serviço, extensão ou dependência global é instalado.

Os nove arquivos do player foram determinados a partir do [HTML oficial](https://github.com/viresh-ratnakar/exolve/blob/8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2/exolve-player.html), em vez de deduzidos pelo nome: `exolve-player.html`, `exolve-m.css`, `exolve-m.js`, `exolve-from-ipuz.js`, `exolve-from-puz.js`, `exolve-from-text.js`, `exolve-to-ipuz.js`, `exolve-to-puz.js` e `exolve-exost.js`. O décimo arquivo é a licença. Não há imagem ou fonte externa necessária para carregar o player e abrir os IPUZ deste perfil. Após abrir uma cruzada, o player tenta carregar três scripts opcionais de Webifi que não pertencem a esse repositório; a ausência deles não impede o uso básico da grade.

O player oficial possui recursos próprios de armazenamento de tentativa e de hospedagem Exost. Eles não fazem parte do aplicativo Cruzadas de Papel. A conferência local não usa hospedagem, cadastro, envio, e-mail ou acesso a dados de navegação. O servidor de QA pode bloquear conexões externas com `connect-src 'none'`; o player sem patches precisa permitir os seus scripts e handlers inline locais. Não clicar nas ações de hospedagem Exost.

O servidor da aplicação iniciado por `npm run dev` tem uma allowlist e não serve `local/exolve`. Para o ensaio externo, iniciar um servidor de QA separado, limitado à pasta do player:

```sh
python3 -m http.server 4174 --bind 127.0.0.1 --directory local/exolve
```

Abrir [Exolve Player local](http://127.0.0.1:4174/exolve-player.html). O endereço começa na raiz desse servidor; não inclui `/local/exolve/`. Encerrar o servidor após o ensaio. O comando acima usa o servidor padrão Python sem adicionar uma política CSP; o bloqueio de conexões mencionado acima é uma configuração adicional possível do servidor de QA.

## Evidência parcial: conversor oficial em Node

```sh
node tools/check-exolve-conversion.mjs \
  --report local/qa/converter.json \
  fixtures/demo-activity.ipuz fixtures/demo-solution.ipuz
```

A ferramenta confere o SHA256 do `exolve-from-ipuz.js` oficial e executa somente sua função de conversão em um contexto `node:vm` com timeout. O contexto recebe texto JSON e um coletor limitado à saída de console; não recebe `require`, `process`, `fetch`, DOM ou capacidades de rede. A geração dinâmica de código e de WebAssembly está desativada. Não é uma execução de navegador nem uma fronteira de segurança para código arbitrário: o código executado é o arquivo oficial previamente autenticado pelo hash fixado.

O resultado precisa conservar largura, altura, todos os bloqueios e células claras, todas as pistas escapadas e números escritos nas pistas; atividade vira grade com zeros e gabarito vira grade com as letras corretas. O relatório associa cada entrada a seu SHA256. **Este teste não prova renderização, numeração inferida, digitação ou botões de revelar do Chrome.**

## Evidência de navegador: dois downloads reais

O ensaio de navegador deve usar CUA em Chrome visível e registrar seu resultado próprio. Roteiro reproduzível:

1. Abrir a demonstração original no aplicativo local. Baixar os cinco arquivos pela interface, mantendo os nomes `cruzadas-projeto.json`, `cruzadas-atividade.ipuz`, `cruzadas-gabarito.ipuz`, `cruzadas-atividade.svg` e `cruzadas-gabarito.svg`.
2. Abrir o player oficial no servidor separado, em `http://127.0.0.1:4174/exolve-player.html`. Usar o input de arquivo real `#xlvp-file` para escolher **o arquivo de atividade efetivamente baixado**.
3. Conferir a grade 15×13 com 28 células claras e oito números distintos; `1` inicia CASA horizontal e CAFE vertical. Conferir cinco pistas horizontais e quatro verticais, incluindo os caracteres `&` e `<` como texto. Digitar numa célula e conferir visualmente. Registrar a ausência de revelar soluções para a atividade, incluindo controles ocultos/desabilitados conforme o comportamento oficial observado.
4. Selecionar pelo mesmo input **o gabarito efetivamente baixado**. Conferir as mesmas células, pistas e números; digitar e usar a ação de revelar da pista selecionada, registrando as letras reveladas. A comprovação dessa ação não equivale a comprovar o botão de revelar tudo.
5. Conservar os cinco downloads e os registros da sessão. O player pode reutilizar tentativas por seu próprio armazenamento; a observação deve distinguir uma letra digitada ou restaurada de uma solução revelada. Não ler esse armazenamento, cookies ou estado interno para construir a prova.

Os seletores extraídos das fontes oficiais, que podem orientar observações de DOM visível sem acessar estado privado, são `.xlv-grid`, `.xlv-grid-input`, `[id$="-across"]`, `[id$="-down"]` e `[id$="-reveal-all"]`. A presença de um seletor na fonte não significa que ele esteja visível ou habilitado em ambos os modos; isso é justamente algo a observar no Chrome.

## Verificar os cinco arquivos independentemente

O ensaio de 09/11/2026 foi concluído com os dois IPUZ reais: a atividade foi preenchida no Chrome sem controles visíveis de solução; o gabarito foi conferido no navegador integrado com **Reveal this** em cada uma das nove pistas, chegando às 28 células corretas. O [registro de validação](VALIDACAO.md) descreve o alcance e a limitação da confirmação nativa do botão global. Os [hashes dos arquivos](EVIDENCIAS-ARQUIVOS.json) identificam os bytes usados, sem confundir as referências Node com os downloads.

```sh
python3 tools/check_downloads.py \
  --fixture fixtures/demo-project.json \
  --downloads /caminho/para/os/cinco-downloads \
  --report local/qa/downloads-independent.json
python3 -m unittest discover -s tests/python -v
```

O verificador usa somente a biblioteca padrão Python (`json`, XML, Unicode e HTML), sem importar ou invocar o núcleo ou o IO do aplicativo. A partir do projeto do autor, reconstrói cada letra e ocupação, identifica todas as sequências maximais de duas ou mais células, confere que correspondem às entradas cadastradas, calcula os componentes do grafo de cruzamentos e numera os inícios compartilhados por linha e coluna. A demonstração tem geometria conhecida manualmente nos testes: nove palavras, 28 células claras, oito cruzamentos, um componente e oito números distintos.

O JSON baixado deve ser byte a byte o projeto canônico esperado. Os dois IPUZ têm whitelist estrutural fechada; a atividade não pode carregar `solution`, `answer`, `answers`, `source`, `entries`, checksums, estado salvo ou campos auxiliares. Blocos, zeros, números, pistas completas, comprimentos, metadados escapados e letras do gabarito são comparados à reconstrução independente. Isso não tenta apagar uma resposta que o próprio autor resolveu escrever numa pista ou no título.

Os dois SVGs são lidos como XML, sem renderizador. O verificador confere cada célula e seu preenchimento, coordenadas explícitas, números, letras somente no gabarito, cabeçalhos e pistas completas após juntar os `tspan`. Recusa scripts, HTML, recursos e links externos, eventos, estilos, grupos ou atributos extras para dados ocultos e texto adicional. Essa inspeção estrutural não afirma equivalência tipográfica entre renderizadores.

As linhas do SVG usam uma quebra conservadora que preserva todos os caracteres, sem depender do suporte do renderizador a `textLength`: cada ponto Unicode ASCII custa uma unidade e os demais custam duas. O orçamento por linha de pista é 26 unidades com fonte 16; título usa 28 com fonte 30, subtítulo 54 com fonte 16 e autoria 60 com fonte 14. A quebra usa o último espaço disponível dentro do orçamento, sem exigir preenchimento mínimo; somente um token maior que o orçamento é fragmentado. O verificador confere a preferência pelo último espaço e o conteúdo completo, incluindo os espaços preservados. `textLength`/`lengthAdjust` continuam como ajuste adicional. O canvas mantém largura de 1000 unidades e células de 32; a altura é variável e limitada a 28000 unidades, inclusive para textos máximos. O limite de texto de linha única também recusa U+2028/U+2029 e U+FFFE/U+FFFF; os dois últimos não podem ser representados em XML 1.0. Renderizações auxiliares e sua origem devem ser identificadas no registro da entrega; a alteração da quebra, por si só, não constitui uma nova prova visual ou de navegador.

O relatório cria os diretórios pais solicitados e identifica os cinco arquivos por nome, tamanho e SHA256. Não produz PNG e não usa capturas falsas como evidência. Também não atesta por si só que os arquivos vieram do Chrome; essa proveniência pertence ao ensaio visível anterior. As referências em `fixtures/interop/` são saídas geradas com Node para testar o verificador e estão identificadas explicitamente como **referências estáticas, não downloads de navegador**. Os testes corrompem os próprios dados, números, campos secretos, pistas, geometria e letras para verificar que falhas reais são recusadas.
