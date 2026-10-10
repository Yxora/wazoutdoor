import tseslint from 'typescript-eslint'

// Sens des dépendances : ui, infra -> application -> domain
const interdire = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
})

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ['src/domain/**/*.ts'],
    rules: interdire(['**/application/*', '**/infra/*', '**/ui/*'], 'Le domaine ne dépend de rien.'),
  },
  {
    files: ['src/application/**/*.ts'],
    rules: interdire(['**/infra/*', '**/ui/*'], "L'application ne dépend que du domaine."),
  },
  {
    files: ['src/infra/**/*.ts'],
    rules: interdire(['**/ui/*'], "L'infra ne dépend pas de la vue."),
  },
  {
    files: ['src/ui/**/*.ts'],
    rules: interdire(['**/infra/*'], "La vue ne dépend pas de l'infra."),
  },
)
