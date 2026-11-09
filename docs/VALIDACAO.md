# Validação e alcance das evidências

Registro de 9 de novembro de 2026. Esta página distingue testes automatizados, conversão de arquivos, uso de navegador e publicação. Uma etapa não comprova as demais.

## Testes executados

`npm test` passou com **25 testes Node**, sem falhas ou casos ignorados, durante a implementação. O conjunto reúne 12 testes do modelo e 13 de IO. A execução local foi feita com Node 22. A CI repete o conjunto em Node 22 e 24, além do trabalho independente Python; os resultados por commit ficam em [Actions](https://github.com/martinlofranodeoliveira/cruzadas-de-papel/actions).

O modelo é verificado com limites de texto e grade, normalização explícita, cópias e congelamento, recusa de getters e estruturas forjadas, colisões, posições fora da grade, atomicidade, numeração, início compartilhado, pendências, tentativas e busca de encaixes. Um oráculo independente de intervalos e união compara 700 geometrias determinísticas. A busca também é confrontada com enumeração independente e um replay de projeto.

O IO fixa os bytes canônicos dos três arquivos da demonstração, o roundtrip do projeto, os limites inclusivos de 512 KiB em UTF-8, opções fechadas sem executar getters, escape de campos HTML/XML e ausência estrutural de solução na atividade. Uma grade pronta com 40 entradas e pistas de 200 pontos Unicode verifica o conteúdo completo, as quebras reais e a altura do SVG. Uma regressão remove as dicas de ajuste SVG antes de conferir o orçamento das linhas com ASCII largo e Unicode. Outra exige palavras comuns inteiras, incluindo “histórias” e “lembranças”, e conserva espaços duplos. Esses testes de texto e geometria não são uma avaliação visual de todos os renderizadores.

Para reproduzir:

```sh
npm ci --ignore-scripts
npm test
python3 -m unittest discover -s tests/python -v
```

Os **18 testes Python passaram**, sem falhas, na execução local deste registro. O conjunto usa somente a biblioteca padrão. Seus testes usam os SVGs de referência descritos em [fixtures/interop/README.md](../fixtures/interop/README.md); esses arquivos foram gerados por Node e **não são downloads do navegador**. Os casos incluem arquivos válidos, corrupções de geometria, normalização, numeração, conteúdo de pistas, solução, metadados e hashes do preparador, além da recusa de caracteres incompatíveis com XML e de linhas longas mesmo quando o ajuste SVG não está presente. Esse resultado não substitui a conferência da interface.

## Conversor externo

O consumidor de referência é o Exolve, MIT, commit `8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2`, sem modificações. O preparo exige uma ação explícita, confere SHA-256 dos arquivos oficiais e não instala componentes no sistema:

```sh
python3 tools/prepare-exolve.py --download
python3 tools/prepare-exolve.py --verify-local
node tools/check-exolve-conversion.mjs \
  fixtures/demo-activity.ipuz fixtures/demo-solution.ipuz
```

A execução já observada da função oficial do conversor em um contexto Node isolado aceitou os dois IPUZ da demonstração, preservando 15 × 13 células, bloqueios, nove pistas e presença de solução somente no gabarito. A ferramenta também confere o hash do conversor antes de executá-lo.

Isso comprova o comportamento da função de conversão para esses arquivos. Não comprova renderização, foco, digitação, controles de revelar ou funcionamento do player completo em Chrome. O Exolve não é incluído no aplicativo ou na distribuição estática; os arquivos preparados ficam em `local/exolve/` para QA local.

## Downloads e reconstrução independente

`tools/check_downloads.py` não importa o modelo ou o IO do aplicativo. Ele reconstrói diretamente do JSON as letras, ocupantes, sequências máximas, números, cruzamentos e componentes. Depois compara os dois IPUZ e os dois SVGs, usando JSON, XML e `html.unescape` da biblioteca padrão. Também produz hashes para associar o relatório aos bytes verificados.

Após baixar pela interface os cinco arquivos, execute:

```sh
python3 tools/check_downloads.py \
  --fixture fixtures/demo-project.json \
  --downloads /caminho/para/downloads \
  --report local/qa/downloads.json
```

O diretório precisa conter `cruzadas-projeto.json`, `cruzadas-atividade.ipuz`, `cruzadas-gabarito.ipuz`, `cruzadas-atividade.svg` e `cruzadas-gabarito.svg`. O verificador confere estrutura e conteúdo dos arquivos fornecidos; ele não sabe como foram obtidos. O registro do navegador deve demonstrar separadamente que os bytes vieram dos botões da interface.

## Interface e arquivos realmente baixados

O ensaio local usou Chrome visível. Foram observados: preparação `ação → ACAO`; recusa de `ßa` preservando o rascunho ao trocar de entrada; movimento com cruzamento incompatível recusado sem alterar a grade; importação inválida e cancelamento de uma importação válida sem perda; retirada de uma palavra com bloqueio das saídas finais; sugestão explícita de recolocação; desfazer restaurando os bytes do projeto original; e redução da grade recusada integralmente.

Uma tentativa com uma letra correta e uma incorreta indicou 1 correta em 28, 2 preenchidas, 1 incorreta e 26 vazias. A tentativa completa indicou **28 corretas de 28**. Cancelar a limpeza conservou as 28 letras; confirmar limpou a tentativa. O JSON efetivamente baixado foi reaberto pelo seletor nativo, confirmado e baixado de novo: os 2483 bytes continuaram idênticos ao projeto canônico.

Os cinco arquivos vieram dos botões reais da interface. Após a correção final de quebra das pistas, os dois SVGs foram baixados novamente. Todos passaram pelo verificador independente; seus tamanhos e hashes estão em [EVIDENCIAS-ARQUIVOS.json](EVIDENCIAS-ARQUIVOS.json). As referências Node de `fixtures/interop` continuam identificadas separadamente.

## Player oficial em navegador

O player Exolve local, sem patches e autenticado pelos hashes fixados, abriu os dois IPUZ efetivamente baixados. No **Chrome**, a atividade mostrou grade 15 × 13, 28 células claras, oito números distintos e nove pistas. A digitação de CASA e CAFE ocupou sete células distintas, compartilhando o C. Não havia controles visíveis para verificar ou revelar a solução nesse arquivo.

No gabarito, os controles de solução apareceram. A conferência completa foi feita no **navegador integrado**, selecionando cada uma das nove pistas e usando o botão oficial **Reveal this**: todas as 28 células corresponderam à solução exportada. Os textos `&` e `2 < 3` permaneceram literais. A ação global Reveal all não integra a evidência concluída: sua confirmação nativa bloqueou a ferramenta de interação no Chrome; a aba de teste foi fechada e a conferência foi concluída pista por pista, sem modificar o player.

Esse ensaio cobre a demonstração original neste consumidor e nessas sessões. Não comprova todo leitor IPUZ, todos os navegadores ou variantes não implementadas do padrão.

## SVG e revisão visual

Os dois SVGs realmente baixados foram renderizados com FFmpeg/librsvg já disponível no ambiente e as imagens resultantes foram abertas. A primeira revisão encontrou sobreposição quando o renderizador ignorou `textLength`; a implementação passou a quebrar linhas reais, preservando palavras que cabem no orçamento. A revisão dos downloads finais confirmou pistas completas sem sobreposição e letras apenas no gabarito. Essas imagens são renderizações auxiliares de QA; o aplicativo não exporta PNG ou PDF.

A interface foi capturada no navegador integrado em viewports 1280 × 720, 390 × 844 e 1920 × 961; as capturas completas excluem 10 px da barra de rolagem. As fontes estavam carregadas e o documento não apresentou rolagem horizontal. A grade pode rolar dentro de sua própria região em telas estreitas. [preview.jpg](preview.jpg) é uma captura real do editor.

Uma revisão independente pediu persistir o contrato de direção e tornar o foco da entrada selecionada distinto da seleção comum. Os dois ajustes foram feitos e avaliados como **resolvidos**, com disposition `ship` no passe de veredito. A medição por DOM confirmou foco de 3 px nos três tamanhos. Esse veredito cobre os dois ajustes; não é certificação formal de acessibilidade. O detector executado estava limitado à análise por regex, sem parser HTML ou contraste calculado. Não há comparação com uma composição aprovada; as perguntas opcionais de direção ficaram sem resposta e a direção implementada permaneceu provisória. Os painéis externos completos de referência responderam HTTP 403 e não foram avaliados integralmente.

## Distribuição e publicação

`npm run build` prepara somente 19 arquivos estáticos permitidos; `npm run check` verifica a lista exata, o grafo de módulos locais, as licenças e os hashes. O player Exolve e os dados de QA não integram a distribuição. A CI e a publicação Pages usam Actions fixadas por SHA.

A [release v1.0.0](https://github.com/martinlofranodeoliveira/cruzadas-de-papel/releases/tag/v1.0.0) identifica o commit e oferece fonte, distribuição, projeto de exemplo e `SHA256SUMS`. Os logs públicos em Actions permitem conferir o resultado daquele commit. Os hashes dos downloads de demonstração neste documento identificam os arquivos testados; eles não substituem os hashes dos ZIPs da release.
