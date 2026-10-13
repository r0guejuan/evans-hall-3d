// Study notes hidden around Evans Hall. Each one holds the answer to a professor's power-up
// question; ids match backend/quiz.py, and the professors' hints point at these spots.
export const NOTES = [
  {
    id: 'z1',
    from: 'Prof. Zaman · MGT 409',
    place: 'Ross Library, west bookshelves',
    p: [-39.8, 1.5, 4],
    text: 'When an LLM confidently states something false or made up, that is a HALLUCINATION. Always check its sources.',
  },
  {
    id: 'z2',
    from: 'Prof. Zaman · MGT 409',
    place: 'West-most glass meeting room, south side',
    p: [-31.8, 0.95, 45.3],
    text: 'LLMs read and write in TOKENS: chunks of text about three-quarters of a word long. Pricing and context limits are counted in tokens.',
  },
  {
    id: 'z3',
    from: 'Prof. Zaman · MGT 409',
    place: 'Beinecke Terrace Room, north table',
    p: [35.75, 0.95, -4.5],
    text: 'The SYSTEM PROMPT is the set of instructions an LLM gets before the user speaks. It sets the role, tone, and rules.',
  },
  {
    id: 'z4',
    from: 'Prof. Zaman · MGT 409',
    place: 'Classroom 2430, lectern',
    p: [16.16, 1.3, 28.3],
    text: 'OVERFITTING: the model memorizes its training data and does badly on new data. Always test on data it has never seen.',
  },
  {
    id: 'z5',
    from: 'Prof. Zaman · MGT 409',
    place: 'East-most glass meeting room, north side',
    p: [19.4, 0.95, -45.3],
    text: 'An AI agent takes actions by calling TOOLS (tool calls / function calls): search a database, send an email, run code.',
  },
  {
    id: 's1',
    from: 'Prof. Schott · MGT 407',
    place: 'Classroom 2420, lectern',
    p: [1.66, 1.3, 28.3],
    text: 'Central limit theorem, in plain English: averages of big samples follow a NORMAL (bell-shaped) curve, even if the data do not.',
  },
  {
    id: 's2',
    from: 'Prof. Schott · MGT 407',
    place: 'Ross Library, north bookshelf',
    p: [-37.25, 2.05, -6.5],
    text: 'Standard error of the mean = SD / √n, where n is the SAMPLE SIZE. Bigger samples, smaller error. Problem Set 1, Q12!',
  },
  {
    id: 's3',
    from: 'Prof. Schott · MGT 407',
    place: 'Middle glass meeting room, south side',
    p: [-6.2, 0.95, 45.3],
    text: 'Correlation runs from -1 to +1. Plain English: +1 means the two move together perfectly.',
  },
  {
    id: 's4',
    from: 'Prof. Schott · MGT 407',
    place: 'Beinecke Terrace Room, south table',
    p: [35.75, 0.95, 4.5],
    text: 'Ordinary least squares picks the line that minimizes the sum of SQUARED ERRORS (squared residuals).',
  },
  {
    id: 's5',
    from: 'Prof. Schott · MGT 407',
    place: 'Classroom 2410, lectern',
    p: [-12.84, 1.3, 28.3],
    text: 'p < 0.05, in plain English: if the true effect were ZERO, a result this big would be pretty unlikely.',
  },
]
