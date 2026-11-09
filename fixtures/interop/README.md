# Referências do verificador independente

`reference-activity.svg` e `reference-solution.svg` são saídas de `exportSvg` para `../demo-project.json`, geradas por Node para testes estáticos do verificador Python. **Não são downloads do Chrome nem evidência de funcionamento do navegador.**

Os testes juntam esses SVGs aos três arquivos canônicos da demonstração em uma pasta temporária, verificam o conjunto e aplicam corrupções reais aos arquivos e estruturas. A geometria conhecida de nove palavras, seus oito inícios distintos, 28 células claras e oito cruzamentos está escrita manualmente nos testes Python. O verificador não importa código JavaScript do aplicativo.

As referências usam a quebra final por último espaço disponível, sem preenchimento mínimo. Os testes preservam explicitamente as palavras `histórias.` e `lembranças.`, verificam os orçamentos reais de linha sem `textLength` e recusam a fragmentação desnecessária de uma palavra mesmo quando o texto completo continua presente.

Para reproduzir estas duas referências a partir do repositório, execute Node com `exportSvg(JSON.parse(readFileSync('fixtures/demo-project.json', 'utf8')))`, uma vez com as opções padrão e outra com `{solution: true}`. A prova de navegador usa outra pasta contendo os cinco arquivos realmente baixados pela interface; a ferramenta não transforma estas referências em tal prova.
