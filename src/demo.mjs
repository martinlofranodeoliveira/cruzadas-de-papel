import { validateProject } from './model.mjs';

/** Original miniature, written for this project; no external crossword source. */
export function createDemoProject() {
  return validateProject({
    version: 1,
    puzzle: {
      id: 'demo-cotidiano-01',
      title: 'Pequenas cenas do cotidiano',
      subtitle: 'Uma cruzada original para ligar lugares, ideias e objetos.',
      author: 'LOFRANO TECNOLOGIA',
      width: 15,
      height: 13,
    },
    entries: [
      { id: 'casa', source: 'casa', answer: 'CASA', clue: 'Lugar de morar, com porta, janelas & histórias.', placement: { row: 2, col: 2, direction: 'across' } },
      { id: 'cafe', source: 'café', answer: 'CAFE', clue: 'Bebida de grãos torrados que perfuma a cozinha.', placement: { row: 2, col: 2, direction: 'down' } },
      { id: 'feira', source: 'feira', answer: 'FEIRA', clue: 'Encontro de bancas, frutas e vozes na rua.', placement: { row: 4, col: 2, direction: 'across' } },
      { id: 'acao', source: 'ação', answer: 'ACAO', clue: 'O que põe uma ideia em movimento; em 2 < 3, comparar já é uma.', placement: { row: 4, col: 6, direction: 'down' } },
      { id: 'arte', source: 'arte', answer: 'ARTE', clue: 'Criação que pode ganhar forma em pintura, música ou dança.', placement: { row: 6, col: 6, direction: 'across' } },
      { id: 'tema', source: 'tema', answer: 'TEMA', clue: 'Assunto que costura uma conversa ou um texto.', placement: { row: 6, col: 8, direction: 'down' } },
      { id: 'mala', source: 'mala', answer: 'MALA', clue: 'Companheira de viagem que leva roupas e lembranças.', placement: { row: 8, col: 8, direction: 'across' } },
      { id: 'lua', source: 'lua', answer: 'LUA', clue: 'Vizinha celeste que muda de aparência ao longo do mês.', placement: { row: 8, col: 10, direction: 'down' } },
      { id: 'agua', source: 'água', answer: 'AGUA', clue: 'Líquido que mata a sede e rega a horta.', placement: { row: 10, col: 10, direction: 'across' } },
    ],
  });
}
