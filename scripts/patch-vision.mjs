/**
 * Patch the bundled @deepseek-ai/dsh-llm-deepseek adapter so the DeepSeek
 * models accept image content (deepseek-v4-pro gained native image input on
 * 2026-08-13; the rc.6 adapter still declares/串 serializes text-only).
 *
 * Changes (all verified against the compiled lib/index.js in rc.6):
 *  1. declare inputModalities ["text", "image"]
 *  2. replace the image-rejecting assertTextOnly with a userContent builder
 *     that emits OpenAI-style image_url parts (base64 data URL)
 *  3. make serializeMessages / serializeRequest async and thread a readImage fn
 *  4. wire the durable attachment service into the adapter (resolveAttachments)
 *
 * Idempotent: re-running is a no-op once the patch is applied.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TARGET = path.join(
  __dirname, '..', 'backend', 'vendor', 'node_modules',
  '@deepseek-ai', 'dsh-llm-deepseek', 'lib', 'index.js',
)

function replaceOnce(src, oldStr, newStr) {
  if (!src.includes(oldStr)) {
    throw new Error(`patch-vision: target not found:\n${JSON.stringify(oldStr.slice(0, 120))}`)
  }
  return src.replace(oldStr, newStr)
}

function replaceAll(src, oldStr, newStr) {
  if (!src.includes(oldStr)) {
    throw new Error(`patch-vision: target not found (all):\n${JSON.stringify(oldStr.slice(0, 120))}`)
  }
  return src.split(oldStr).join(newStr)
}

let src = fs.readFileSync(TARGET, 'utf8')

// Idempotency guard.
if (src.includes('inputModalities: ["text", "image"]')) {
  console.log('patch-vision: already applied, skipping.')
  process.exit(0)
}

// 1. declare image input capability.
src = replaceAll(src, 'inputModalities: ["text"]', 'inputModalities: ["text", "image"]')

// 2. swap the rejecting assertTextOnly for an image content builder.
src = replaceOnce(
  src,
  `/** Reject core image content before any text-flattening path can silently erase it. */
function assertTextOnly(blocks) {
\tif (contentHasImage(blocks)) throw new LlmError("The DeepSeek chat-completions adapter does not support image content.", "UNSUPPORTED_CONTENT");
}`,
  `/** Build a user-message wire content: a plain string when text-only, or an
 * OpenAI-style part array (text + image_url) when images are present. */
async function userContent(message, readImage) {
\tconst images = message.content.filter((block) => block.type === "image");
\tconst text = flattenText(message.content);
\tif (images.length === 0) return text;
\tconst parts = [];
\tif (text.length > 0) parts.push({ type: "text", text });
\tfor (const block of images) {
\t\tif (readImage === void 0) throw new LlmError("DeepSeek image input requires the durable attachment service.", "UNSUPPORTED_CONTENT");
\t\tconst stored = await readImage(block.attachment);
\t\tparts.push({ type: "image_url", image_url: { url: \`data:\${block.attachment.mediaType};base64,\${Buffer.from(stored.data).toString("base64")}\` } });
\t}
\treturn parts;
}`,
)

// 3. serializeMessages: async + image-aware user content.
src = replaceOnce(src, 'function serializeMessages(messages) {', 'async function serializeMessages(messages, readImage) {')
src = replaceOnce(src, '\t\tassertTextOnly(message.content);\n', '')
src = replaceOnce(
  src,
  `\t\tconst toolResults = message.content.filter((block) => block.type === "tool-result");
\t\tconst text = flattenText(message.content);
\t\tif (text.length > 0 || toolResults.length === 0) wire.push({
\t\t\trole: "user",
\t\t\tcontent: text
\t\t});`,
  `\t\tconst toolResults = message.content.filter((block) => block.type === "tool-result");
\t\tconst content = await userContent(message, readImage);
\t\tif (content !== "" || toolResults.length === 0) wire.push({
\t\t\trole: "user",
\t\t\tcontent
\t\t});`,
)

// 4. serializeRequest: async + forward readImage.
src = replaceOnce(src, 'function serializeRequest(options, defaults = {}) {', 'async function serializeRequest(options, defaults = {}, readImage) {')
src = replaceOnce(src, '\tmessages.push(...serializeMessages(options.messages));', '\tmessages.push(...await serializeMessages(options.messages, readImage));')

// 5. request(): resolve attachments and await serialization.
src = replaceOnce(
  src,
  `\t\tconst body = serializeRequest(options, connection.defaults);`,
  `\t\tconst readImage = this.config.resolveAttachments === void 0 ? void 0 : async (ref) => (await this.config.resolveAttachments()).readImage(ref, signal);
\t\tconst body = await serializeRequest(options, connection.defaults, readImage);`,
)

// 6. adapter: expose the attachment service.
src = replaceOnce(
  src,
  `\tconst adapter = new DeepSeekAdapter({
\t\toptions,
\t\tresolveApiKey,
\t\tresolveUserId
\t});`,
  `\tconst adapter = new DeepSeekAdapter({
\t\toptions,
\t\tresolveApiKey,
\t\tresolveUserId,
\t\tresolveAttachments: () => ctx.get("attachments")
\t});`,
)

fs.writeFileSync(TARGET, src)
console.log('patch-vision: applied to', TARGET)
