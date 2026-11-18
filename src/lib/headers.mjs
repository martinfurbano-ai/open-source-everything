export const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; manifest-src 'self'
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

export function parseHeaders(text) {
  return text.split('\n').reduce((rules, line) => {
    if (!line.trim()) return rules;
    if (!/^\s/.test(line)) return [...rules, { pattern: line.trim(), values: {} }];
    const separator = line.indexOf(':');
    if (!rules.length || separator < 0) throw new Error(`_headers: invalid rule ${line}`);
    const last = rules.at(-1);
    const values = { ...last.values, [line.slice(0, separator).trim()]: line.slice(separator + 1).trim() };
    return [...rules.slice(0, -1), { ...last, values }];
  }, []);
}
export function responseHeaders(rules, path) {
  return rules.filter(({ pattern }) => pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern)
    .reduce((merged, rule) => ({ ...merged, ...rule.values }), {});
}
