# Demonstração original

“Pequenas cenas do cotidiano” e suas nove pistas foram escritas para Cruzadas de Papel. O arranjo não foi copiado de uma cruzada externa. O projeto usa o ID estável `demo-cotidiano-01`; os IDs de entrada são palavras ASCII estáveis, sem depender do número exibido.

`demo-project.json` é o arquivo do autor e inclui as respostas originais, as letras canônicas e as posições. `demo-activity.ipuz` é a atividade sem solução estrutural; `demo-solution.ipuz` acrescenta somente `solution`. Os três arquivos são UTF-8 sem BOM, JSON com indentação de dois espaços e um LF final. A ordem do cadastro é a ordem da tabela abaixo. `serializeProject(parseProject(bytes))` conserva exatamente os bytes do projeto canônico.

## Arranjo fixado

A grade tem **15 colunas × 13 linhas**. As posições da tabela usam índices a partir de **zero**, como o projeto; a numeração da cruzada começa em um. Horizontal e vertical que começam na mesma célula recebem o mesmo número.

| ID | Original → letras | Direção | Linha | Coluna | Número | Letras | Cruzamentos |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| casa | casa → CASA | horizontal | 2 | 2 | 1 | 4 | 1 |
| cafe | café → CAFE | vertical | 2 | 2 | 1 | 4 | 2 |
| feira | feira → FEIRA | horizontal | 4 | 2 | 2 | 5 | 2 |
| acao | ação → ACAO | vertical | 4 | 6 | 3 | 4 | 2 |
| arte | arte → ARTE | horizontal | 6 | 6 | 4 | 4 | 2 |
| tema | tema → TEMA | vertical | 6 | 8 | 5 | 4 | 2 |
| mala | mala → MALA | horizontal | 8 | 8 | 6 | 4 | 2 |
| lua | lua → LUA | vertical | 8 | 10 | 7 | 3 | 2 |
| agua | água → AGUA | horizontal | 10 | 10 | 8 | 4 | 1 |

Grade do gabarito (`#` significa bloqueio):

```text
###############
###############
##CASA#########
##A############
##FEIRA########
##E###C########
######ARTE#####
######O#E######
########MALA###
########A#U####
##########AGUA#
###############
###############
```

Há **9 entradas, 9 posicionadas, 0 sem posição, 36 letras nas palavras, 8 células de cruzamento, 28 células claras, 167 bloqueios e 1 componente conectado**. Os oito inícios distintos geram números de 1 a 8. A soma dos cruzamentos por entrada é 16, pois cada célula cruzada pertence a duas palavras. Todas as sequências máximas de pelo menos duas letras correspondem exatamente a uma entrada; todas têm pista. Portanto a demonstração está pronta para exportar.

Os originais `café`, `ação` e `água` tornam explícita a conversão de acentos para letras A–Z. As pistas contêm `&` e `<` como texto. No IPUZ, os campos definidos como HTML pela especificação recebem escape, e o comprimento é anexado como texto literal, por exemplo ` (4)`. O perfil usado é o [IPUZ v2](https://www.puzzazz.com/ipuz/v2), tipo `http://ipuz.org/crossword#1`, retangular, ASCII A–Z, bloqueio `#` e célula vazia `0`; não há JSONP, links de recursos ou campos auxiliares com respostas na atividade.

## Geometria do SVG

Os dois SVGs são gerados pela mesma demonstração, na interface ou por `exportSvg`. Não são arquivos-fonte adicionais desta pasta. A folha é um SVG independente de largura **1000**, com margens de 56, células de **32 × 32**, grade centralizada e altura calculada a partir de todo o texto. A posição real da grade aparece em `g#grid`, nos atributos `data-x`, `data-y` e `data-cell-size`; cada célula tem `data-row`, `data-col` e um retângulo com coordenadas absolutas. Números usam `data-role="number"`; letras aparecem somente no gabarito e usam `data-role="letter"`.

Horizontal começa em x=56; Vertical, em x=512. Cada coluna tem largura máxima de 432. As pistas ficam em grupos `data-direction` e `data-number`; concatenar o texto dos `tspan` recupera exatamente `número. pista (comprimento)`, sem perder espaços, acentos, sinais ou outros pontos Unicode permitidos. As quebras são reais e não dependem de `textLength`: cada ponto ASCII custa uma unidade, e qualquer outro ponto Unicode custa duas. Cada linha de pista admite **26 unidades**, incluindo o prefixo numérico e o comprimento. A quebra usa o último espaço disponível antes do limite, mesmo que a linha fique curta. Somente um token que exceda sozinho o orçamento pode ser dividido entre pontos Unicode. Nada é aparado ou descartado.

As pistas usam fonte nominal 16, de modo que 26 unidades deixam um orçamento conservador de 416 dentro da coluna de 432. O título usa orçamento de 28 unidades, fonte 30 e largura 888; o subtítulo, 54/16/888; e a autoria, 60/14/888. Todos preferem espaços sem exigir preenchimento mínimo. Cada linha também recebe `textLength` e `lengthAdjust="spacingAndGlyphs"` como dicas complementares. Um ensaio real com FFmpeg/librsvg mostrou que esse consumidor ignorava as dicas e fazia as linhas antigas atravessarem a coluna vizinha; a política de quebra foi reduzida por esse motivo. A revisão seguinte preservou palavras comuns como “histórias” e “lembranças”, que a exigência de preenchimento mínimo fragmentava. Essa geometria conservadora não promete métricas tipográficas idênticas ou cobertura de todos os glifos em todos os sistemas.

Uma pista, incluindo prefixo e comprimento, tem no máximo 209 pontos Unicode. Duas linhas consecutivas não finais consomem juntas mais de 26 unidades: se coubessem juntas, a quebra não teria sido necessária. Como um ponto custa no máximo duas unidades, esse par consome pelo menos 14 pontos. Logo, no máximo 30 linhas podem resultar dos 209 pontos. São 20 unidades verticais por linha e 10 de intervalo por pista: mesmo colocando as 40 pistas permitidas em uma única coluna, a altura das pistas é no máximo 24400. Título, subtítulo e autoria têm, respectivamente, no máximo 14, 12 e 6 linhas pelo mesmo cálculo por pares. Com cabeçalhos, intervalos e grade 21 × 21, o cálculo total fica abaixo de **28000 unidades de altura**. Todos os textos são XML escapados; não há script, HTML, imagem, recurso externo nem respostas escondidas na atividade. O projeto do autor e o modo de experimentar não são formatos de distribuição com segredo das respostas.

## Regeneração local

Na raiz do repositório, com Node 22 ou superior:

```sh
node --input-type=module <<'NODE'
import { writeFile } from 'node:fs/promises';
import { createDemoProject } from './src/demo.mjs';
import { serializeProject, exportIpuz } from './src/io.mjs';
const project = createDemoProject();
await writeFile('fixtures/demo-project.json', serializeProject(project));
await writeFile('fixtures/demo-activity.ipuz', exportIpuz(project));
await writeFile('fixtures/demo-solution.ipuz', exportIpuz(project, { solution: true }));
NODE
node --test tests/io.test.mjs
```

Os testes fixam os bytes canônicos e as contagens, os limites de importação, o escape, a ausência estrutural de solução, o conteúdo integral do SVG e uma grade pronta com 40 entradas e pistas de 200 pontos. A verificação Python independente e a conferência do consumidor externo têm evidências próprias; os testes de IO não alegam demonstrar compatibilidade de todos os leitores IPUZ.
