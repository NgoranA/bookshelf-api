import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';


const specContent = readFileSync(new URL('../../docs/openapi.yaml', import.meta.url), 'utf-8');
const spec = YAML.parse(specContent);

export const mountDocs = (app) => {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  app.get('/openapi.yaml', (req, res) => {
    res.type('text/yaml').send(specContent);
  })
}
