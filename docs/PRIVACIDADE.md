# Privacidade e conservação do trabalho

## Onde ficam as palavras

O aplicativo trabalha na memória da aba. Respostas, pistas, posições, histórico de desfazer e tentativa de resolução não são enviados a um servidor de aplicação. Não há conta, telemetria, formulário de envio, sincronização ou gravação automática em `localStorage`, `sessionStorage` ou IndexedDB.

Fechar ou recarregar a aba encerra essa sessão. Para continuar depois, baixe `cruzadas-projeto.json` e abra esse arquivo na próxima sessão. O histórico de até 30 estados e a tentativa de resolução não acompanham o JSON. O arquivo baixado fica na pasta escolhida pelo navegador; cabe a você guardar, copiar ou apagar essas cópias.

A abertura de um arquivo lê o conteúdo local escolhido por você. Ele é validado como UTF-8 e projeto v1 antes de substituir o projeto. Uma importação recusada conserva o trabalho atual. A interface pede confirmação nas ações que substituem o projeto ou descartam um rascunho.

## O que cada arquivo revela

O **projeto JSON do autor contém todas as respostas legíveis**, incluindo o original com acentos e as letras canônicas. Os dois gabaritos também contêm a solução. O modo **Experimentar** é uma prévia do autor: a aplicação aberta já tem acesso às respostas para conferir a tentativa. Ele não oferece controle de acesso ou isolamento entre autor e participante.

Os arquivos **de atividade** omitem as letras da solução e os campos auxiliares de respostas. Título, autoria, subtítulo e pistas continuam visíveis. Se você escrever uma resposta nesses textos, ela fará parte do arquivo. Revise o conteúdo antes de distribuir e selecione o arquivo adequado.

Evite colocar dados pessoais de participantes nas pistas ou na autoria se isso não for necessário à atividade. O aplicativo não busca esses dados em outras fontes nem precisa deles para funcionar.

## Rede e hospedagem

O código e as fontes são servidos junto com o site; não há carregamento de fontes por uma CDN externa. Depois de carregar a aplicação, o processamento de uma cruzada usa o navegador. Downloads são produzidos localmente, sem envio do projeto a um conversor remoto.

Ao acessar a versão hospedada, o provedor de hospedagem recebe as requisições HTTP normais para servir a página e seus arquivos. O navegador, suas extensões, o sistema operacional e a pasta de downloads têm políticas próprias. A ausência de telemetria no aplicativo não significa que a hospedagem deixe de receber essas requisições.

Para uso local, execute `npm run dev` e abra o endereço local mostrado no terminal. A preparação opcional do Exolve baixa arquivos públicos oficiais para verificar interoperabilidade; ela não recebe ou envia seu projeto. O player de QA é separado da distribuição do aplicativo.

## Dúvidas e problemas

O comportamento e as exportações são descritos em [FORMATO.md](FORMATO.md). Para relatar uma falha, prefira uma cruzada fictícia mínima. Não anexe seu projeto real se ele incluir informações que você não quer publicar. O procedimento para problemas de segurança está em [SECURITY.md](../SECURITY.md).
