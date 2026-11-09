# Comunicação de problemas de segurança

O projeto é uma aplicação estática local, sem autenticação ou servidor de dados. Ainda assim, importação de arquivos, renderização de textos e exportações precisam tratar conteúdo autoral como dados. Um arquivo com texto inesperado não deve executar código, carregar recursos externos ou substituir o projeto quando a validação falha.

Se encontrar uma falha, prepare uma reprodução mínima com conteúdo fictício. Anote o navegador, a versão ou commit do aplicativo, as etapas e o efeito observado. Não inclua credenciais, dados de terceiros ou um projeto pessoal completo.

Quando o repositório oferecer **Report a vulnerability** na aba **Security**, use esse canal privado. Se o canal não estiver disponível, abra uma issue apenas informando a categoria geral do problema e pedindo um meio de compartilhar a reprodução; deixe fora dela o conteúdo explorável e dados sensíveis. Não há prazo de resposta ou programa de recompensa declarado.

## Escopo útil para relatos

- Texto de título, pista ou autoria tratado como HTML ativo.
- SVG ou IPUZ com conteúdo executável, recursos externos ou dados de resposta em um campo indevido da atividade.
- Importação malformada que contorne os limites, altere estado parcialmente ou execute um getter fornecido como objeto à API.
- Uma edição recusada que descarte o projeto ou um rascunho sem a ação de confirmação prevista.

O projeto JSON do autor e os arquivos de gabarito contêm respostas legíveis por definição. O modo Experimentar também conhece a solução, pois é uma prévia do autor. Isso é descrito em [docs/PRIVACIDADE.md](docs/PRIVACIDADE.md); a separação de atividade e gabarito se aplica aos arquivos exportados, não ao controle de acesso dentro da sessão de autoria.

Correções devem ser verificadas contra a reprodução, as regras do [formato](docs/FORMATO.md) e o conjunto de testes relevante. O projeto não declara auditoria independente ou certificação de segurança.
