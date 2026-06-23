// routes/docs.js — serves human-friendly, interactive API documentation.
//
// We keep a single source of truth in openapi.yaml (the API "contract") and let
// Swagger UI render it at /docs with a "Try it out" button. We also expose the
// raw spec at /openapi.yaml so other tools can consume it.

import { readFileSync } from 'node:fs'
import YAML from 'yaml'
import swaggerUi from 'swagger-ui-express'

// Resolve openapi.yaml relative to THIS file (works no matter where you run from).
const specUrl = new URL('../../openapi.yaml', import.meta.url)
const specText = readFileSync(specUrl, 'utf8')
const spec = YAML.parse(specText)

export function mountDocs (app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec))
  app.get('/openapi.yaml', (req, res) => {
    res.type('text/yaml').send(specText)
  })
}
