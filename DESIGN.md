---
name: Cruzadas de Papel
description: Uma oficina de cruzamentos reais, com peças claras em um quadro de trabalho.
colors:
  ink: "#213637"
  muted: "#526361"
  paper: "#fffdf7"
  ground: "#edf0e9"
  line: "#c4ccc3"
  board: "#243b3c"
  board-muted: "#c2d4ca"
  cell: "#fff9ed"
  amber: "#f2b562"
  amber-ink: "#382914"
  error: "#982f25"
  focus: "#a64e16"
  field: "#fffefa"
  selected-row: "#d8e2d2"
  row-hover: "#e0e7d9"
  dark-hover: "#365557"
  amber-hover: "#f9c684"
typography:
  display:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "23px"
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Source Sans 3, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.4
  grid-letter:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0"
rounded:
  cell: "2px"
  field: "4px"
  control: "5px"
  board: "8px"
  dialog: "10px"
spacing:
  compact: "8px"
  control: "12px"
  region: "16px"
  mobile-page: "18px"
  section: "24px"
  desktop-page: "28px"
components:
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  button-primary:
    backgroundColor: "{colors.board}"
    textColor: "{colors.cell}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  button-primary-hover:
    backgroundColor: "{colors.dark-hover}"
    textColor: "{colors.paper}"
  button-apply:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.control}"
    padding: "9px 8px"
  button-apply-hover:
    backgroundColor: "{colors.amber-hover}"
  button-text:
    backgroundColor: "transparent"
    padding: "4px 0"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 10px"
  inspector:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "19px 17px 0"
  entry-selected:
    backgroundColor: "{colors.selected-row}"
    textColor: "{colors.ink}"
    padding: "11px 8px"
  board:
    backgroundColor: "{colors.board}"
    textColor: "{colors.cell}"
    rounded: "{rounded.board}"
    padding: "20px 18px 0"
  grid-cell:
    backgroundColor: "{colors.cell}"
    textColor: "{colors.ink}"
    typography: "{typography.grid-letter}"
    rounded: "{rounded.cell}"
  grid-cell-selected:
    backgroundColor: "{colors.amber}"
---

# Design System: Cruzadas de Papel

## Overview

**Creative North Star: "Quadro de palavras"**

A interface se organiza como um quadro de trabalho: as células mostram a geometria real da cruzada, enquanto superfícies claras acomodam a preparação das palavras. A identidade vem do contraste entre quadro cinza-esverdeado, letras claras e seleção âmbar, com títulos compactos e controles planos. A composição privilegia trabalho contínuo e informação ligada à seleção.

Este documento registra o mundo implementado em código. A direção é provisória: candidato 4, seed `c0b4b6b9`, adotado após perguntas opcionais sem resposta; não constitui aprovação do usuário. Não há composição visual aprovada. Os valores vêm de `styles.css`, a estrutura de `index.html` e os estados de `src/app.mjs`; as capturas fornecidas de desktop, móvel e 1920px corroboram a aparência estática. A revisão final liberou somente as duas correções pontuais de persistência e foco. Não houve calibração com os painéis completos de referência, auditoria integral de acessibilidade ou verificação de movimento por este documento.

**Key Characteristics:**

- Quadro estável com células claras, bloqueios escuros e seleção ligada à palavra real.
- Bricolage Grotesque na identidade, nos números e nas letras; Source Sans 3 na leitura e operação.
- Profundidade por cor e contorno, com controles próximos de seu contexto.
- Ordem móvel centrada primeiro na grade e depois na edição.

## Colors

A paleta combina verdes acinzentados discretos com claros quentes; o âmbar identifica a palavra em edição e sua ação de aplicação. Os valores normativos estão no frontmatter e preservam os hexadecimais da fonte CSS. As rampas OKLCH do sidecar são amostras derivadas para visualização, não novas cores usadas pela aplicação.

### Primary

- **Quadro verde-acinzentado** (`board`): fundo da grade, botão de salvar e modo ativo. `dark-hover` responde ao ponteiro nos botões escuros.
- **Âmbar de seleção** (`amber`): células da entrada selecionada e botão de aplicar. `amber-ink` sustenta o texto do botão; `amber-hover` é sua resposta ao ponteiro.

### Neutral

- **Tinta verde-escura** (`ink`) e **texto secundário** (`muted`): leitura principal e explicações, respectivamente.
- **Papel quente** (`paper`), **campo claro** (`field`) e **fundo sálvia** (`ground`): cabeçalho e editor, campos e plano geral.
- **Peça clara** (`cell`): células com letras e texto sobre os controles escuros.
- **Linha sálvia** (`line`): separações entre regiões e entradas, sem relevo.
- **Coordenada clara** (`board-muted`): eixos e metadados dentro do quadro.
- **Sálvia de seleção** (`selected-row`) e **sálvia de passagem** (`row-hover`): seleção da lista e estados de aproximação. A pista selecionada usa a segunda tonalidade.
- **Vermelho de erro** (`error`): mensagens e bordas inválidas. **Marrom de foco** (`focus`): contorno de teclado nos controles claros.

**The Selection Rule.** Reserve o âmbar das células para a entrada selecionada. A lista e a pista usam tonalidades sálvia; foco de teclado permanece um estado visual independente.

## Typography

**Display Font:** Bricolage Grotesque, com fallback `sans-serif`.
**Body Font:** Source Sans 3, com fallback `sans-serif`.

As duas famílias são arquivos locais, distribuídos sob OFL sem alteração. A Bricolage dá presença compacta e arredondada à identidade e às letras; a Source mantém pistas, ajuda e formulários legíveis em espaços densos. A escala é ajustada por função, sem proporção modular declarada.

### Hierarchy

- **Display:** identidade do cabeçalho; diminui nos intervalos intermediários e volta a ganhar presença no cabeçalho móvel.
- **Headline:** título da atividade e títulos de diálogo. Títulos longos podem quebrar palavras para caber.
- **Title:** títulos das regiões. A edição ganha um título maior no móvel.
- **Body:** o papel do frontmatter corresponde às pistas de desktop. Explicações e estados usam tamanhos menores; texto de diálogo e pistas móveis usam tamanhos maiores.
- **Label:** rótulos de campos e comandos compactos; caixa normal e peso marcado.
- **Grid letter:** letras da cruzada. Os números de início são menores e usam Source Sans 3; coordenadas e estatísticas usam algarismos tabulares.

Os campos principais do editor e de busca chegam a 16px no móvel. Ajuda técnica de identificador mantém sua exceção menor. Pistas usam comprimento natural e quebra de texto; a explicação de exportação é limitada a 56ch e a ajuda junto à grade, a 44ch.

**The Letter Rule.** Preserve a distinção entre letra, número de pista e coordenada. Não transforme letras da grade em texto de formulário ou números de pista em ornamento.

## Layout

O conteúdo é centralizado em um limite de 1580px, com margens internas de desktop e separação por linhas finas. A oficina padrão tem três colunas: lista (205px), quadro flexível e editor (282px), com intervalos de 22px. A partir de 1450px, lista e editor passam a 225px e 300px, e o intervalo a 28px. Até 1150px, as laterais ficam mais compactas (170px e 252px; intervalo de 16px).

Entre 721px e 940px, lista e editor se empilham na coluna esquerda (180px), enquanto o quadro mantém a coluna direita. Até 720px, as regiões viram uma sequência: quadro, editor e lista. As pistas passam de duas colunas a uma, os formatos de exportação se empilham e a lista de palavras usa duas colunas. O cabeçalho mantém quatro ações em uma linha própria.

A grade usa uma faixa de coordenadas (22px), células quadradas e intervalos de 1px. A célula padrão mede 30px; passa a 34px no intervalo amplo, 26px no compacto e móvel, e 28px na composição intermediária de duas colunas. A largura da grade permanece intrínseca. Quando necessário, só sua área rola horizontalmente; não se comprimem as letras para acomodar toda a grade.

Em desktop, o editor possui rolagem própria com altura máxima de 740px e título aderente. No modo de experimentar, ele sai da composição e a lista passa a uma coluna de 230px junto do quadro. O móvel conserva a sequência vertical. Intervalos curtos agrupam campos e comandos; linhas e espaços maiores separam conferência, pistas e exportação.

## Elevation & Depth

A oficina é plana: o quadro escuro, o papel do editor e as linhas de separação criam hierarquia sem sombras nas regiões de trabalho. O diálogo modal é a única superfície elevada, com sombra difusa (`0 18px 64px #21363742`) e fundo escurecido (`#1b302f80`). Não há textura simulada, iluminação decorativa ou transformação de escala no hover.

**The Stable Board Rule.** A geometria não se move para demonstrar estado. Uma alteração aplicada pode destacar as células da entrada selecionada com um contorno que se desfaz em 160ms, com `cubic-bezier(.16,1,.3,1)`; a preferência por movimento reduzido desativa a animação. O código atual arma esse destaque em qualquer commit que mude o projeto, não apenas em movimentos espaciais. Essa gramática é constatada no código, não medida nas capturas estáticas.

## Shapes

Células quase quadradas têm cantos mínimos; campos, botões e quadro recebem arredondamento progressivo conforme os papéis do frontmatter. O editor e as linhas da lista mantêm cantos retos. Divisórias e bordas são finas; números de início ocupam o canto superior esquerdo de células reais. Não existe silhueta decorativa independente da cruzada.

O foco geral usa contorno marrom sólido de 3px com afastamento de 3px. Nas entradas da lista, ele fica para dentro (-3px), depois da regra de seleção, para continuar visível na linha selecionada. Dentro da grade, o foco usa o claro das peças e afastamento de 1px; a área rolável usa âmbar com contorno interno.

## Components

### Buttons

Comandos pequenos, planos e de leitura direta. O botão secundário usa papel com borda sálvia; o escuro dá peso a salvar e verificar; o âmbar aplica a palavra junto aos campos. O botão base tem altura mínima de 38px. O formulário ajusta espaçamento e tamanho dos comandos ao seu contexto; no móvel, aplicar e cancelar chegam a 44px de altura mínima.

Hover troca a cor sem deslocamento. O estado ativo usa a cor definida na cascata atual, sem animação adicional. Desabilitados têm opacidade reduzida e cursor de indisponibilidade. Ações de texto são sublinhadas, sem caixa; excluir usa texto vermelho e confirmação separada. Todas conservam foco visível.

### Chips

Rótulos pequenos e retangulares indicam “Exemplo original” e “Rascunho”. O primeiro usa sálvia; o segundo, um claro quente. São informações textuais, sem aparência de filtro ou interação. O rótulo de exemplo some em intervalos intermediários e reaparece no móvel.

### Cards / Containers

O editor é uma superfície de papel com borda, cantos retos e preenchimento compacto; sua nota de salvamento forma uma faixa tonal no rodapé. Não há uma família de cartões promocionais. O quadro é o contêiner escuro arredondado, com rolagem interna, coordenadas e faixa inferior de contexto.

### Inputs / Fields

Campos claros com borda de 1px e cantos discretos. O textarea permite ajuste vertical. O foco usa o contorno comum, enquanto a invalidação usa borda vermelha e mensagem textual próxima. Campos de posição oferecem linha, coluna e direção; o checkbox explícito determina se a entrada será posicionada. A resposta original e a prévia em A–Z permanecem visíveis em níveis distintos.

### Navigation

A navegação de projeto apresenta Novo, Abrir projeto, Salvar projeto e Exemplo, nessa ordem. O comando de salvar conserva o tratamento escuro. O seletor de modo usa dois botões unidos, com o ativo escuro; a diferença de estado também é exposta por `aria-pressed`.

### Numbered entry and clue

Cada entrada liga número, resposta e contexto de posição/cruzamentos em uma linha de largura total. Seleção usa fundo sálvia e contorno fino, foco usa contorno marrom mais espesso. Um rascunho acrescenta texto próprio. A pista correspondente recebe destaque sem esconder sua frase. A numeração deriva da posição; entradas no mesmo início podem compartilhar o número.

### Crossword grid

Células claras carregam letras; bloqueios preservam o fundo escuro com contorno discreto; cruzamentos sem seleção recebem uma tonalidade clara esverdeada. A entrada ativa usa âmbar em suas células reais. Um cruzamento alterna entre suas entradas ao selecionar; nenhuma região ornamental substitui esse vínculo. Na tentativa, cada célula recebe uma letra A–Z; erros ganham cor, contorno e estado de invalidação.

Selecionar, mover e encontrar encaixes possuem controles explícitos. As sugestões indicam linha, coluna, direção e cruzamentos e exigem aplicação por botão. O uso não depende de arrastar. Mensagens de estado e erro aparecem junto ao trabalho em português.

## Do's and Don'ts

### Do:

- **Do** manter a grade como geometria real, com letras, números e coordenadas em papéis distintos.
- **Do** usar o âmbar para a entrada selecionada e a ação de aplicar, preservando foco de teclado separado.
- **Do** conservar as fontes locais e a hierarquia entre identidade compacta e leitura operacional.
- **Do** manter a rolagem horizontal dentro da área da grade quando as células não couberem.
- **Do** mostrar estados por texto e forma além da cor, próximos dos controles correspondentes.

### Don't:

- **Don't** acrescentar textura de giz, papel simulado ou ilustração ao quadro implementado.
- **Don't** aplicar sombras às regiões de trabalho ou deslocar células em estados de hover.
- **Don't** esconder a preparação da resposta original para A–Z atrás de um efeito visual.
- **Don't** substituir o contorno de foco pelo destaque persistente de seleção.
- **Don't** tratar a direção provisória ou a revisão pontual como aprovação do usuário ou auditoria integral da interface.
