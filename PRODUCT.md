# Cruzadas de Papel

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

HTML, CSS e JavaScript estáticos, demonstração no GitHub Pages, conforme opção já confirmada pelo usuário para a continuidade dos projetos abertos. Node22/24 para testes/build. Nenhuma dependência de execução externa prevista; APIs nativas e núcleo próprio para o objeto espacial. Exolve é consumidor externo de verificação, separado da aplicação.

## Users

Hipótese de implementação após pergunta opcional sem resposta durante a preparação: docentes e pessoas que preparam atividades de aulas e oficinas. Autores de passatempos também podem usar a ferramenta. Não há pesquisa com usuários externos nem instituição usuária comprovada.

## Product Purpose

Atender ao objetivo autorizado de continuar entregando projetos open source úteis e distintos no GitHub do usuário. Construir uma cruzada autoral com palavras que compartilham células, pistas numeradas e arquivos reutilizáveis. Sucesso: a pessoa entende por que uma palavra não cabe, conserva seu rascunho e consegue produzir atividade e gabarito coerentes quando todas as pendências foram resolvidas.

## Positioning

Um construtor espacial local de palavras cruzadas, com validação de geometria e numeração derivada das posições. Não é questionário, banco de questões, dicionário ou gerador de conteúdo. Pistas e respostas são declaradas por quem prepara o trabalho. Sugestões de encaixe não escrevem pistas nem prometem arranjo ótimo.

## Operating Context

Cadastrar resposta original e pista, ver a preparação da resposta em letras A–Z, colocar/mover entradas na grade, conferir cruzamentos e palavras acidentais, experimentar a resolução e guardar o projeto do autor. Arquivos separados para resolver e consultar gabarito. Coordenadas da interface começam em1; o formato de projeto usa0.

## Capabilities and Constraints

Contrato em CONTRACT.md: grade retangular5..21 por eixo, até40entradas, uma letra A–Z por célula. source original preservado e answer derivada por normalização explícita: acentos, cedilha, espaços/hífens/apóstrofos admitidos. Outras letras/caracteres não representáveis são recusados. Pistas/título conservam português e acentos.

Rascunhos incompletos podem ser salvos. Exportações finais exigem pistas, todas as entradas posicionadas, conexão por cruzamentos e correspondência entre sequências maximais da grade e palavras cadastradas. Não há simetria obrigatória ou promessa de padrão editorial universal.

Projeto JSON portátil; SVG de atividade/gabarito e IPUZ de um perfil retangular bloqueado. IPUZ para resolver omite solução e campos auxiliares de respostas; IPUZ com solução contém respostas legíveis. Textos autorais podem revelar uma resposta se o autor assim os escrever. Sem PDF automático, câmera, conta, envio, colaboração simultânea ou armazenamento implícito. Salvar JSON antes de fechar a aba.

## Brand Commitments

LOFRANO TECNOLOGIA, https://lofranotecnologia.com.br/, documentação e interface em português, código original MIT. Preservar o README principal do perfil GitHub; divulgação somente em PROJETOS-ABERTOS.md e EVIDENCIAS.md. Nenhum dado ou credencial de outro projeto será transportado.

## Evidence on Hand

Inventário de 250 repositórios públicos entre 281 próprios consultado em 09/11/2026. READMEs de Banco de Questões, Caderno de Revisão, schema-form-studio e vizinhos confirmam ausência deste fluxo espacial de cruzadas. Perfil IPUZ baseado na especificação oficial Puzzazz v2 e consumidor Exolve MIT fixado no commit 8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2. O player oficial aceitou os dois IPUZ realmente baixados da interface: atividade digitável sem controles de solução no Chrome; gabarito com nove respostas e 28 células reveladas no navegador integrado.

Demonstração autoral com nove palavras portuguesas e pistas originais, incluindo início horizontal/vertical compartilhado e resposta original acentuada. Não é uma cruzada copiada de publicação externa. A interface foi exercitada em navegador, inclusive resolução completa e ida e volta do JSON com bytes iguais. O registro detalhado de validação distingue esses ensaios de uso por pessoas externas, que não é alegado.

## Product Principles

- A identidade da entrada é seuID; o número da pista deriva da posição.
- Preparação de letras precisa ser visível antes de aplicar.
- Uma edição recusada conserva projeto e rascunho.
- Pendências espaciais impedem finalizar, mas não apagam o trabalho.
- Atividade, gabarito e projeto do autor são arquivos com propósitos distintos.

## Accessibility & Inclusion

Decisões de implementação: labels, foco visível, teclado, mensagens de estado e controles explícitos de posição/direção; arrastar nunca é necessário. Composição adaptada a telas pequenas, com rolagem local da grade quando necessária. Nenhuma certificação formal de acessibilidade foi solicitada ou realizada.
