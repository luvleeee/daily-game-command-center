import { newMetric } from './metrics';

/**
 * Quick-add library. Picking one pre-fills link, stats and a suggested category.
 * Stats are created fresh each time (new ids) via the `metrics()` factory.
 * Reset times default to local midnight — every field stays editable.
 *
 * Only Pyragrams' share format was provided by you; the others use common patterns and
 * the reader shows what it found before saving, so you can correct anything.
 */
const M = (name, type, extra = {}) => newMetric({ name, type, ...extra });
const label = (l, pos = 'before') => ({ mode: 'label', label: l, labelPos: pos });

export const PRESETS = [
  {
    name: 'Pyragrams',
    url: 'https://www.pyralinks.com/puzzle/pyragrams',
    category: 'Word Games',
    metrics: () => [
      M('Attempts', 'number', { emoji: '🎯', better: 'lower', reader: label('🎯') }),
      M('Time', 'time', { emoji: '🕓', reader: label('🕓') }),
      M('Swaps', 'number', { emoji: '🔀', better: 'lower', optional: true, reader: label('🔀') }),
      M('Solved', 'winloss'),
    ],
  },
  { name: 'Wordle', url: 'https://www.nytimes.com/games/wordle/index.html', category: 'Word Games', metrics: () => [M('Guesses', 'guesses', { max: 6 })] },
  {
    name: 'Connections',
    url: 'https://www.nytimes.com/games/connections',
    category: 'Word Games',
    metrics: () => [M('Mistakes', 'number', { better: 'lower', unit: 'mistakes', reader: { mode: 'connections' } })],
  },
  { name: 'Strands', url: 'https://www.nytimes.com/games/strands', category: 'Word Games', metrics: () => [M('Hints', 'number', { emoji: '💡', better: 'lower', reader: { mode: 'count', label: '💡' } })] },
  { name: 'The Mini', url: 'https://www.nytimes.com/crosswords/game/mini', category: 'Word Games', metrics: () => [M('Time', 'time')] },
  { name: 'Spelling Bee', url: 'https://www.nytimes.com/puzzles/spelling-bee', category: 'Word Games', metrics: () => [M('Points', 'number', { unit: 'pts' })] },
  { name: 'Letter Boxed', url: 'https://www.nytimes.com/puzzles/letter-boxed', category: 'Word Games', metrics: () => [M('Words', 'number', { better: 'lower', unit: 'words' })] },
  { name: 'Contexto', url: 'https://contexto.me/', category: 'Word Games', metrics: () => [M('Guesses', 'number', { better: 'lower', unit: 'guesses' })] },
  { name: 'Semantle', url: 'https://semantle.com/', category: 'Word Games', metrics: () => [M('Guesses', 'number', { better: 'lower', unit: 'guesses' })] },
  {
    name: 'Waffle',
    url: 'https://wafflegame.net/',
    category: 'Word Games',
    metrics: () => [M('Stars', 'number', { emoji: '⭐', unit: '★', reader: { mode: 'regex', regex: '(\\d)\\s?/\\s?5' } })],
  },
  { name: 'Krillion', url: 'https://krillion.io/', category: 'Trivia', metrics: () => [M('Depth', 'number', { unit: 'm' })] },
  { name: 'TimeGuessr', url: 'https://timeguessr.com/', category: 'Trivia', metrics: () => [M('Points', 'number', { unit: 'pts' })] },
  { name: 'Worldle', url: 'https://worldle.teuteuf.fr/', category: 'Geography', metrics: () => [M('Guesses', 'guesses', { max: 6 })] },
  { name: 'Globle', url: 'https://globle-game.com/', category: 'Geography', metrics: () => [M('Guesses', 'number', { better: 'lower', unit: 'guesses' })] },
  { name: 'Nerdle', url: 'https://nerdlegame.com/', category: 'Math & Logic', metrics: () => [M('Guesses', 'guesses', { max: 6 })] },
  { name: 'Sudoku', url: 'https://www.nytimes.com/puzzles/sudoku', category: 'Math & Logic', metrics: () => [M('Time', 'time')] },
  { name: 'Framed', url: 'https://framed.wtf/', category: 'Movies & Music', metrics: () => [M('Guesses', 'guesses', { max: 6 })] },
  { name: 'Bandle', url: 'https://bandle.app/', category: 'Movies & Music', metrics: () => [M('Guesses', 'guesses', { max: 6 })] },
  { name: 'Costcodle', url: 'https://costcodle.com/', category: 'Trivia', metrics: () => [M('Guesses', 'guesses', { max: 6 })] },
];

/** Accent swatches for per-game colour. '' = automatic (from the name). */
export const ACCENTS = ['', '#a78bfa', '#60a5fa', '#22d3ee', '#34d399', '#a3e635', '#facc15', '#fb923c', '#f87171', '#f472b6'];
