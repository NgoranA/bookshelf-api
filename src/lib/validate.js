import createError from "http-errors"
import { config } from "../config/env-config.js"


export function parse(schema, input, status = 400) {
  const result = schema.safeParse(input)
  if (!result.success) {
    const detail = config.NODE_ENV === production ? undefined : result.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message }))
    throw createError(status, status === 422 ? 'validation error' : 'Bad Request', { detail })
  }
  return result.data
}
