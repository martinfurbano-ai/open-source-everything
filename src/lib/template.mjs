import { escapeHtml, lookup } from './files.mjs';

function parse(source, file) {
  const tokens = source.split(/({{[\s\S]*?}})/g);
  let cursor = 0;
  function block(end, insideIf = false, insideProjects = false) {
    const nodes = [];
    while (cursor < tokens.length) {
      const token = tokens[cursor++];
      if (!token.startsWith('{{')) { nodes.push({ text: token }); continue; }
      const key = token.slice(2, -2).trim();
      if (key === end) return nodes;
      if (key.startsWith('/')) throw new Error(`${file}: unexpected closing block ${key}`);
      if (key.startsWith('#if ')) {
        if (insideIf) throw new Error(`${file}: nested if is not allowed`);
        const condition = key.slice(4);
        if (!condition.startsWith('cfg:')) throw new Error(`${file}: unknown condition ${condition}`);
        nodes.push({ condition, children: block('/if', true, insideProjects) });
      } else if (key === '#projects') {
        if (insideProjects) throw new Error(`${file}: nested projects is not allowed`);
        nodes.push({ projects: true, children: block('/projects', insideIf, true) });
      } else {
        if (key.startsWith('#')) throw new Error(`${file}: unknown block ${key}`);
        nodes.push({ key });
      }
    }
    if (end) throw new Error(`${file}: unclosed block ${end}`);
    return nodes;
  }
  const nodes = block();
  if (source.replace(/{{[\s\S]*?}}/g, '').includes('{{')) throw new Error(`${file}: unclosed placeholder`);
  return nodes;
}
function required(object, key) {
  const value = lookup(object, key);
  if (value === undefined || value === null) throw new Error(`missing value ${key}`);
  if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`invalid scalar ${key}`);
  return value;
}
const htmlTags = new Set(['a', 'br', 'em', 'strong', 'code', 'kbd', 'span']);
function trustedHtml(value) {
  const source = String(value);
  const stack = [];
  let cursor = 0;
  while ((cursor = source.indexOf('<', cursor)) !== -1) {
    const match = source.slice(cursor).match(/^<(\/?)([a-z][a-z0-9]*)([\t\n\f\r ]+(?:"[^"<>]*"|'[^'<>]*'|[^'"<>])*)?[\t\n\f\r ]*(\/?)>/i);
    if (!match) throw new Error('invalid or unclosed HTML tag');
    const [, closing, rawTag, rawAttributes = '', selfClosing] = match;
    const tag = rawTag.toLowerCase();
    const attributes = rawAttributes.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '');
    if (!htmlTags.has(tag)) throw new Error(`HTML tag ${tag} is not allowed`);
    if (closing) {
      if (attributes || selfClosing || stack.pop() !== tag) throw new Error(`unbalanced HTML tag ${tag}`);
    } else {
      if (attributes && !(tag === 'br' && attributes === '/' && !selfClosing)) {
        const href = attributes.match(/^href[\t\n\f\r ]*=[\t\n\f\r ]*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))$/i);
        if (tag !== 'a' || !href) throw new Error(`HTML attributes on ${tag} are not allowed`);
        if (!/^(https:\/\/|\/|#|mailto:)/.test(href[1] ?? href[2] ?? href[3])) throw new Error('HTML href is not allowed');
      }
      if (selfClosing && tag !== 'br') throw new Error(`unclosed HTML tag ${tag}`);
      if (tag === 'a' && stack.includes('a')) throw new Error('unbalanced nested HTML anchor');
      if (tag !== 'br') stack.push(tag);
    }
    cursor += match[0].length;
  }
  if (stack.length) throw new Error(`unclosed HTML tag ${stack.at(-1)}`);
  return source;
}
function placeholder(key, ctx) {
  if (key === 'lang') return escapeHtml(ctx.lang);
  if (key === 'head' || key === 'scripts') return ctx[key];
  const colon = key.indexOf(':');
  const type = key.slice(0, colon);
  const name = key.slice(colon + 1);
  if (type === 't') return escapeHtml(required(ctx.i18n, name));
  if (type === 'h') return trustedHtml(required(ctx.i18n, name));
  if (type === 'cfg') return escapeHtml(required(ctx.config, name));
  if (type === 'pj') return escapeHtml(required(ctx.project, name));
  if (type === 'p') return escapeHtml(required(ctx.card, name));
  if (type === 'asset') return escapeHtml(ctx.asset(name));
  if (type === 'icon') return `<i class="ic" aria-hidden="true">${ctx.icon(name)}</i>`;
  if (type === 'url') {
    const [id, lang = ctx.lang] = name.split('@');
    const page = ctx.pages.find((item) => item.id === id);
    return escapeHtml(required(page?.paths, lang));
  }
  throw new Error(`unknown placeholder ${key}`);
}
function expand(nodes, ctx) {
  return nodes.map((node) => {
    if (node.text !== undefined) return node.text;
    if (node.condition) {
      const key = node.condition.slice(4);
      const value = lookup(ctx.config, key);
      if (value === undefined) throw new Error(`missing condition ${key}`);
      const result = expand(node.children, ctx);
      return typeof value === 'string' && value.length ? result : '';
    }
    if (node.projects) return ctx.projects.map((project) => expand(node.children, { ...ctx, project: project.data, card: project.card })).join('');
    try { return placeholder(node.key, ctx); }
    catch (error) { throw new Error(`{{${node.key}}}: ${error.message}`, { cause: error }); }
  }).join('');
}
export function render(source, context) {
  try { return expand(parse(source, context.file), context); }
  catch (error) { throw new Error(`${context.file}: ${error.message}`, { cause: error }); }
}
