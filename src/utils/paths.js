/**
 * Node.js built-in module for handling and transforming file URLs
 * @type {import('node:url')}
 */
import { fileURLToPath } from 'node:url';

/**
 * Node.js built-in module for working with file and directory paths
 * @type {import('node:path')}
 */
import path from 'node:path';

/**
 * The absolute file path of the current module
 * Converts the ES module URL to a platform-specific file path string
 * Equivalent to __filename in CommonJS modules
 * @type {string}
 * @constant
 * @example '/Users/username/project/src/utils/pathUtils.js'
 */
export const __filename = fileURLToPath(import.meta.url);

/**
 * The absolute directory path of the current module
 * Extracts the directory portion from the current file's absolute path
 * Equivalent to __dirname in CommonJS modules
 * @type {string}
 * @constant
 * @example '/Users/username/project/src/utils'
 */
export const __dirname = path.dirname(__filename);

/**
 * Resolves an absolute path by joining path segments relative to the current module's directory
 * Normalizes the resulting path and handles platform-specific path separators
 * 
 * @function resolvePath
 * @param {...string} segments - Variable number of path segments to join with the current directory
 * @returns {string} The absolute resolved path constructed from __dirname and the provided segments
 */
export const resolvePath = (...segments) => path.join(__dirname, ...segments);