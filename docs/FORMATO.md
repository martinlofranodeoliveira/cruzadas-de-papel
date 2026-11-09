# Formato do projeto e das exportações

## Projeto do autor, versão 1

O JSON representa uma cruzada retangular e sua edição. Não representa uma tentativa de resolução. O objeto é fechado: campos desconhecidos são recusados em cada nível.

```json
{
  "version": 1,
  "puzzle": {
    "id": "minha-cruzada-01",
    "title": "Minha cruzada",
    "subtitle": "",
    "author": "",
    "width": 11,
    "height": 11
  },
  "entries": [
    {
      "id": "palavra-01",
      "source": "ação",
      "answer": "ACAO",
      "clue": "Ideia que virou movimento.",
      "placement": { "row": 2, "col": 3, "direction": "across" }
    }
  ]
}
```

Esse exemplo tem uma única entrada posicionada; a demonstração completa está em [demo-project.json](../fixtures/demo-project.json). A ordem do array é a ordem de cadastro e é preservada ao guardar e reabrir. Respostas iguais podem existir em IDs diferentes. A identidade de uma entrada é seu ID, e seu número é calculado a partir da posição.

IDs começam com letra ASCII ou algarismo e depois admitem letras ASCII, algarismos, `_` e `-`, até 40 caracteres: `[A-Za-z0-9][A-Za-z0-9_-]{0,39}`. O ID do projeto é estável. A interface cria um ID explícito para um projeto novo.

| Campo | Regra |
| --- | --- |
| `version` | Inteiro `1` |
| `width`, `height` | Inteiros de 5 a 21 |
| `entries` | De 0 a 40 entradas; rascunho vazio permitido |
| `title` | Obrigatório; até 100 pontos Unicode |
| `subtitle` | Até 160 pontos Unicode; vazio é `""` |
| `author` | Até 80 pontos Unicode; vazio é `""` |
| `source` | Resposta original obrigatória; até 80 pontos Unicode |
| `answer` | De 2 a 21 letras A–Z, exatamente a preparação de `source` |
| `clue` | Até 200 pontos Unicode; pode ser `""` no rascunho |
| `placement` | `null` ou posição completa com `row`, `col` e `direction` |

Os textos são de uma linha. Não admitem controles C0, DEL, os separadores de linha U+2028/U+2029, substitutos Unicode isolados ou U+FFFE/U+FFFF, incompatíveis com XML 1.0. Um texto opcional vazio é exatamente `""`; um valor composto apenas por espaços é recusado. O texto aceito é conservado, sem interpretar HTML.

### Preparação de letras

`prepareAnswer` aplica NFD, retira marcas de U+0300 a U+036F e remove somente espaço ASCII, hífen ASCII, apóstrofo ASCII e apóstrofo curvo U+2019. O restante precisa ser composto por letras ASCII antes de converter para maiúsculas. Assim, `ação → ACAO`, `maçã → MACA`, `São Paulo → SAOPAULO` e `d'água → DAGUA`. Caracteres como `ß`, barra, espaço não separável e sublinhado não são transformados silenciosamente.

`source` conserva a resposta original, e `answer` precisa coincidir com essa preparação. Importar um JSON com uma resposta canônica diferente da original gera erro. Pistas, título e autoria conservam acentos e os demais caracteres de texto permitidos.

### Posições e numeração

As coordenadas do arquivo começam em **zero**. `direction` é `"across"` para horizontal ou `"down"` para vertical. Linha e coluna são inteiros não negativos, e a entrada inteira precisa caber na grade. `placement: null` guarda uma palavra ainda sem posição. Na interface, linha e coluna começam em **um**.

Palavras paralelas não podem compartilhar uma célula. Duas palavras perpendiculares podem cruzar uma vez por célula se a letra coincidir; nenhuma célula admite mais de duas entradas. Uma operação que cria conflito ou sai da grade é recusada por inteiro, sem recortar palavras ou alterar o projeto anterior.

Os números derivam dos inícios ocupados em ordem de linha e coluna, a partir de 1. Duas entradas que começam na mesma célula recebem o mesmo número. Alterar uma posição pode renumerar outras palavras; não existe número autoral persistido.

Uma atividade pronta tem pelo menos uma entrada, todas posicionadas, todas com pista e um único componente ligado por cruzamentos. Cada sequência horizontal ou vertical máxima de pelo menos duas letras precisa corresponder exatamente a uma entrada cadastrada. Isso detecta palavras coladas que criariam uma sequência involuntária. Células isoladas na direção oposta não viram palavras de uma letra.

### Leitura e serialização

O limite é **512 × 1024 bytes em UTF-8**, inclusive. A interface lê UTF-8 estrito; o núcleo recebe texto e aplica `JSON.parse` seguido da validação do modelo. Não há detector lexical de chaves repetidas: vale a semântica de `JSON.parse`, na qual a última ocorrência prevalece antes da validação.

A serialização canônica tem ordem fixa de campos, preserva a ordem dos arrays, usa dois espaços de indentação e termina com um LF. Reabrir e guardar um projeto já canônico produz os mesmos bytes. As APIs retornam cópias profundamente congeladas e não alteram seus argumentos. Nenhum relógio, rede, armazenamento ou gerador aleatório participa do núcleo espacial.

## Perfil IPUZ

O aplicativo exporta um perfil retangular, bloqueado e ASCII da [especificação IPUZ v2](https://www.puzzazz.com/ipuz/v2). Não é uma implementação de todas as variantes IPUZ: não cobre rebus, células multiletras, grades barradas, formas arbitrárias ou resposta final adicional. A importação autoral aceita o projeto JSON v1; IPUZ é uma saída para leitores compatíveis.

Campos permitidos na atividade:

```text
version kind uniqueid title author intro dimensions block empty charset puzzle clues
```

O gabarito acrescenta somente `solution`.

| Campo | Valor neste perfil |
| --- | --- |
| `version` | `"http://ipuz.org/v2"` |
| `kind` | `["http://ipuz.org/crossword#1"]` |
| `uniqueid` | `puzzle.id` do projeto |
| `title`, `author`, `intro` | Título, autoria e subtítulo, com escape HTML |
| `dimensions` | `{ "width": W, "height": H }` |
| `block`, `empty` | `"#"` e `0` |
| `charset` | `"ABCDEFGHIJKLMNOPQRSTUVWXYZ"` |
| `puzzle` | Matriz H × W: `"#"` nos bloqueios, número nos inícios, `0` nos outros claros |
| `clues` | Somente `Across` e `Down`, cada qual em ordem numérica |
| `solution` | Apenas no gabarito: matriz H × W com `"#"` ou uma letra A–Z |

Cada pista é `[numero, "pista escapada (comprimento)"]`. O comprimento é texto literal, como ` (4)`. A especificação define os campos de título, autoria, introdução e pistas como HTML; por isso o aplicativo escapa `&`, `<`, `>`, aspas e apóstrofos, em vez de tratar o texto autoral como marcação.

Não são emitidos `answer`, `answers`, `annotation`, `origin`, `checksum`, `saved`, `entries` ou `source`. A atividade não recebe matriz de solução ou cópia auxiliar das respostas. Essa separação é estrutural; não remove uma resposta que você tenha escrito na própria pista. Não há JSONP ou referência a recursos externos.

A ferramenta externa de QA é o [Exolve](https://github.com/viresh-ratnakar/exolve), MIT, no commit `8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2`, sem patch. A execução isolada do conversor em Node é evidência parcial. Compatibilidade de renderização e controles depende de abrir os dois arquivos no player completo, conforme [VALIDACAO.md](VALIDACAO.md).

## Folhas SVG

Atividade e gabarito são documentos SVG independentes, em XML 1.0 UTF-8. A atividade mostra bloqueios, células claras, numeração e todas as pistas; o gabarito acrescenta as letras da grade. Título e rótulo distinguem as duas folhas. Não há fonte incorporada, imagem, recurso externo, script, evento, HTML, `foreignObject` ou JSON escondido.

A largura é 1000 unidades, as células têm 32 × 32 e a grade é centralizada. Pistas horizontais e verticais usam colunas separadas, com até 432 unidades cada. Linhas longas são quebradas sem descartar pontos Unicode ou espaços: ASCII custa uma unidade, os outros pontos custam duas, e cada linha de pista admite 26 unidades, com fonte nominal 16. Prefixo e comprimento também contam. A quebra prefere sempre o último espaço disponível antes do limite, mesmo que a linha fique curta; só fragmenta um token quando ele excede sozinho o orçamento. Título, subtítulo e autoria têm orçamentos proporcionais à sua largura e fonte.

As quebras reais precedem `textLength` e `lengthAdjust="spacingAndGlyphs"`, que são dicas complementares. Um ensaio externo com FFmpeg/librsvg mostrou que esse consumidor ignorava o ajuste SVG e fazia as linhas anteriores invadirem a outra coluna. A política conservadora evita depender desse atributo para conter as pistas. Uma revisão posterior retirou o preenchimento mínimo da linha para preservar palavras comuns. Com os limites do formato, a altura calculada permanece abaixo de **28000 unidades**. O [README das fixtures](../fixtures/README.md) mostra coordenadas, orçamentos e o cálculo desse limite.

Concatenar o texto dos `tspan` de uma pista recupera `número. pista (comprimento)` integralmente. Todo texto autoral recebe escape XML. A família `sans-serif` do renderizador determina o desenho final dos glifos; a geometria explícita não promete métricas idênticas em todos os programas. PDF e PNG não fazem parte das exportações desta versão.
