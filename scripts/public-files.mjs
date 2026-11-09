/** Lista fechada: projeto de trabalho, player de QA e relatórios locais ficam fora. */
export const PUBLIC_FILES = Object.freeze([
  'index.html', 'styles.css', 'logo.svg',
  'src/app.mjs', 'src/model.mjs', 'src/io.mjs', 'src/demo.mjs',
  'assets/bricolage-grotesque.ttf', 'assets/source-sans-3.ttf',
  'assets/BRICOLAGE-OFL.txt', 'assets/SOURCE-SANS-OFL.txt', 'assets/FONTS.json',
  'fixtures/demo-project.json', 'fixtures/demo-activity.ipuz', 'fixtures/demo-solution.ipuz',
  'LICENSE', 'THIRD-PARTY-NOTICES.md',
]);
export const GENERATED_FILES = Object.freeze(['.nojekyll', 'build-manifest.json']);
export const ALLOWED_DIST_FILES = Object.freeze([...PUBLIC_FILES, ...GENERATED_FILES]);
