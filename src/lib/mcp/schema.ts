/**
 * The small slice of JSON Schema the MCP tools need: builders for the
 * `inputSchema` each tool advertises, and a validator that checks incoming
 * arguments against that same schema.
 *
 * Validating against the advertised schema (rather than hand-checking in each
 * tool) keeps the two from drifting: whatever Claude was told the tool takes
 * is exactly what the tool accepts.
 */

export interface JsonSchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: readonly (string | number)[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  default?: unknown;
}

type Props = Record<string, JsonSchema>;

export const s = {
  string: (description?: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'string', description, ...extra }),
  integer: (description?: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'integer', description, ...extra }),
  number: (description?: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'number', description, ...extra }),
  boolean: (description?: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'boolean', description, ...extra }),
  enum: (values: readonly string[], description?: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'string', enum: values, description, ...extra }),
  id: (what: string): JsonSchema => ({ type: 'string', description: `${what} (uuid)` }),
  array: (items: JsonSchema, description?: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'array', items, description, ...extra }),
  /** An object whose keys are listed. Anything unlisted is rejected. */
  object: (properties: Props, required: string[] = [], description?: string): JsonSchema => ({
    type: 'object', properties, required, additionalProperties: false, description,
  }),
  /** A free-form object, e.g. the field values of a record. */
  record: (description?: string): JsonSchema => ({ type: 'object', description, additionalProperties: true }),
};

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Returns a list of human-readable problems; empty means valid. */
export function validate(schema: JsonSchema, value: unknown, path = 'arguments'): string[] {
  const errors: string[] = [];

  if (value === undefined) return errors;

  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') return [`${path} must be a string, got ${typeOf(value)}`];
      if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} must not be empty`);
      break;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) return [`${path} must be an integer, got ${typeOf(value)}`];
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) return [`${path} must be a number, got ${typeOf(value)}`];
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return [`${path} must be true or false, got ${typeOf(value)}`];
      break;
    case 'array':
      if (!Array.isArray(value)) return [`${path} must be an array, got ${typeOf(value)}`];
      if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} needs at least ${schema.minItems} item(s)`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} allows at most ${schema.maxItems} items`);
      if (schema.items) value.forEach((item, i) => errors.push(...validate(schema.items!, item, `${path}[${i}]`)));
      break;
    case 'object': {
      if (typeOf(value) !== 'object') return [`${path} must be an object, got ${typeOf(value)}`];
      const obj = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (obj[key] === undefined) errors.push(`${path}.${key} is required`);
      }
      for (const [key, child] of Object.entries(obj)) {
        const prop = schema.properties?.[key];
        if (prop) errors.push(...validate(prop, child, `${path}.${key}`));
        else if (schema.additionalProperties === false) {
          const known = Object.keys(schema.properties ?? {}).join(', ');
          errors.push(`${path}.${key} is not a known option (expected one of: ${known})`);
        }
      }
      break;
    }
  }

  if (schema.enum && !schema.enum.includes(value as string | number)) {
    errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be at most ${schema.maximum}`);
  }

  return errors;
}
