export type YamlScalar = string | number;
export type YamlNode = YamlScalar | YamlMap;
export type YamlMap = ReadonlyArray<readonly [string, YamlNode]>;

const RESERVED = /^(?:true|false|yes|no|on|off|null|y|n|~)$/i;
const PLAIN_TEXT = /^[A-Za-z][A-Za-z0-9 _.()-]*$/;
const DIMENSION = /^-?\d*\.?\d+(?:px|em|rem)$/;
const PLAIN_KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function scalar(value: YamlScalar): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`cannot serialize ${value} as YAML`);
    return String(value);
  }
  if (DIMENSION.test(value)) return value;
  if (PLAIN_TEXT.test(value) && !value.endsWith(' ') && !RESERVED.test(value)) return value;
  // A JSON string is a valid YAML double-quoted scalar.
  return JSON.stringify(value);
}

function key(name: string): string {
  return PLAIN_KEY.test(name) && !RESERVED.test(name) ? name : JSON.stringify(name);
}

function lines(map: YamlMap, indent: number, out: string[]): void {
  const pad = ' '.repeat(indent);
  for (const [name, value] of map) {
    if (typeof value === 'object') {
      if (!value.length) throw new Error(`YAML map '${name}' is empty`);
      out.push(`${pad}${key(name)}:`);
      lines(value, indent + 2, out);
    } else {
      out.push(`${pad}${key(name)}: ${scalar(value)}`);
    }
  }
}

/** Block-style YAML for string-keyed maps of strings and numbers, in the given key order. */
export function toYaml(map: YamlMap): string {
  const out: string[] = [];
  lines(map, 0, out);
  return out.join('\n');
}
