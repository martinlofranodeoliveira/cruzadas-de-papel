# Como contribuir

Use uma cruzada fictícia pequena para explicar um problema. Inclua a ação que tentou, o resultado esperado, o resultado observado e o navegador. Para importação ou exportação, um projeto mínimo e o nome do arquivo ajudam a reproduzir. Confira o conteúdo antes de anexar: o JSON do autor inclui as respostas legíveis.

## Desenvolvimento local

Com Node.js 22 ou superior:

```sh
npm ci --ignore-scripts
npm run build
npm run dev
```

Execute as verificações relevantes antes de propor uma alteração:

```sh
npm test
python3 -m unittest discover -s tests/python -v
npm run build
```

O núcleo espacial fica em `src/model.mjs`; os formatos, em `src/io.mjs`; e a demonstração original, em `src/demo.mjs`. Leia [CONTRACT.md](CONTRACT.md) para as regras das APIs e [docs/FORMATO.md](docs/FORMATO.md) para o contrato dos arquivos. Preserve cópias, congelamento, recusa integral de alterações inválidas e numeração derivada da grade.

## Ao alterar comportamento

Descreva o problema concreto e o resultado da mudança. Inclua um caso de reprodução e testes que possam detectar a falha, sem apenas repetir a implementação. Mudanças de geometria, limites ou formatos precisam de casos adversariais e revisão das fixtures canônicas. Não regenere fixtures para esconder uma divergência sem explicar a alteração.

Em mudanças de interface, confira foco visível, teclado, telas estreitas e preservação do rascunho depois de uma edição recusada. Mantenha respostas e pistas como texto com `textContent`. Não introduza rede, armazenamento automático, telemetria ou interpretação de HTML autoral.

O Exolve é uma ferramenta externa de QA fixada em um commit, não uma dependência do aplicativo. Sua preparação exige `python3 tools/prepare-exolve.py --download`; o script confere hashes oficiais. Não altere o player upstream ou o empacote na distribuição para fazer uma exportação passar. A [documentação de validação](docs/VALIDACAO.md) separa conversão em Node de conferência real no navegador.

Preserve os avisos MIT e os textos OFL das fontes locais. Não use cruzadas, pistas ou imagens copiadas sem licença compatível e atribuição. A demonstração deste repositório é original.

Para uma possível vulnerabilidade, siga [SECURITY.md](SECURITY.md) antes de publicar detalhes exploráveis ou arquivos com dados reais.
