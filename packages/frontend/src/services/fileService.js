import axios from 'axios';

// Use relative URLs so they go through the Vite proxy
const API_BASE_URL = '';

/**
 * Service for loading real files from the repository
 */
export class FileService {
  /**
   * Load a file from the repository
   * @param {string} filePath - Path relative to project root (e.g., 'packages/frontend/src/main.jsx    // Sort by preference: component > function > class > interface > type > enum > namespace > module > constant > variable
    const typeOrder = { 
      component: 0, 
      function: 1, 
      class: 2, 
      interface: 3, 
      type: 4, 
      enum: 5, 
      namespace: 6, 
      module: 7,
      constant: 8,
      variable: 9 
    }turns {Promise<{content: string, path: string, size: number, modified: Date}>}
   */
  static async loadFile(filePath) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/file/${filePath}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to load file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get language from file extension
   * @param {string} filePath
   * @returns {string}
   */
  static getLanguageFromPath(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const languageMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
      dart: 'dart',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sh: 'bash',
      sql: 'sql',
    };
    return languageMap[ext] || 'plaintext';
  }

  /**
   * Parse imports from JavaScript/TypeScript code
   * @param {string} content - File content
   * @param {string} currentFilePath - Path of the current file for resolving relative imports
   * @returns {Array<{symbol: string, from: string, resolvedPath: string}>}
   */
  static parseImports(content, currentFilePath) {
    const imports = [];

    // More comprehensive import regex patterns
    const patterns = [
      // import defaultExport from 'module'
      /import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/g,
      // import { named } from 'module'
      /import\s+{\s*([^}]+)\s*}\s+from\s+['"`]([^'"`]+)['"`]/g,
      // import * as namespace from 'module'
      /import\s+\*\s+as\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/g,
      // import defaultExport, { named } from 'module'
      /import\s+(\w+),\s*{\s*([^}]+)\s*}\s+from\s+['"`]([^'"`]+)['"`]/g,
    ];

    patterns.forEach((pattern, patternIndex) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let symbols = [];
        let fromPath = '';

        if (patternIndex === 0) {
          // Default import
          symbols = [match[1]];
          fromPath = match[2];
        } else if (patternIndex === 1) {
          // Named imports
          symbols = match[1]
            .split(',')
            .map(s => s.trim().replace(/\s+as\s+\w+$/, ''));
          fromPath = match[2];
        } else if (patternIndex === 2) {
          // Namespace import
          symbols = [match[1]];
          fromPath = match[2];
        } else if (patternIndex === 3) {
          // Default + named imports
          symbols = [
            match[1],
            ...match[2]
              .split(',')
              .map(s => s.trim().replace(/\s+as\s+\w+$/, '')),
          ];
          fromPath = match[3];
        }

        // Resolve relative paths
        let resolvedPath = fromPath;
        if (fromPath.startsWith('./') || fromPath.startsWith('../')) {
          const currentDir = currentFilePath.split('/').slice(0, -1).join('/');
          resolvedPath = this.resolvePath(currentDir, fromPath);
        } else if (fromPath.startsWith('~')) {
          // Handle ~ as project root alias (common in many projects)
          resolvedPath = fromPath.replace(/^~\//, '');
        } else if (fromPath.startsWith('@/')) {
          // Handle @/ as src root alias (common in Vue/Nuxt projects)
          resolvedPath = fromPath.replace(/^@\//, 'src/');
        } else if (!fromPath.startsWith('.') && !fromPath.includes('/')) {
          // If it's a plain module name without path separators, it's likely a node_modules import
          // We'll leave it as-is since we can't resolve node_modules in our file browser
          resolvedPath = fromPath;
        }

        // Add imports
        symbols.forEach(symbol => {
          if (symbol.trim()) {
            imports.push({
              symbol: symbol.trim(),
              from: fromPath,
              resolvedPath,
            });
          }
        });
      }
    });

    console.log('Parsed imports:', imports);
    return imports;
  }

  /**
   * Resolve relative path
   * @param {string} basePath - Base directory path
   * @param {string} relativePath - Relative path to resolve
   * @returns {string}
   */
  static resolvePath(basePath, relativePath) {
    const parts = basePath.split('/');
    const relativeParts = relativePath.split('/');

    for (const part of relativeParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    return parts.join('/');
  }

  /**
   * Find symbols in JavaScript/TypeScript code
   * @param {string} content - File content
   * @returns {Array<{name: string, type: string, line: number, column: number}>}
   */
  static findSymbols(content) {
    const symbols = [];
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      // Function declarations (including TypeScript)
      const functionPatterns = [
        /(?:function\s+|const\s+|let\s+|var\s+)(\w+)\s*[=(]/, // function foo() / const foo =
        /(?:export\s+)?function\s+(\w+)/, // export function foo
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)/, // async function foo
      ];

      functionPatterns.forEach(pattern => {
        const functionMatch = line.match(pattern);
        if (functionMatch) {
          symbols.push({
            name: functionMatch[1],
            type: 'function',
            line: lineIndex + 1, // Convert to 1-based line numbers
            column:
              functionMatch.index + functionMatch[0].indexOf(functionMatch[1]),
          });
        }
      });

      // Class declarations (including TypeScript)
      const classPatterns = [
        /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, // class Foo, export class Foo, abstract class Foo
        /(?:export\s+)?(?:default\s+)?class\s+(\w+)/, // export default class Foo
      ];

      classPatterns.forEach(pattern => {
        const classMatch = line.match(pattern);
        if (classMatch) {
          symbols.push({
            name: classMatch[1],
            type: 'class',
            line: lineIndex + 1,
            column: classMatch.index + classMatch[0].indexOf(classMatch[1]),
          });
        }
      });

      // Component declarations (React) - enhanced patterns
      const componentPatterns = [
        /(?:function|const|let|var)\s+([A-Z]\w+)/,
        /([A-Z]\w+)\s*=\s*(?:styled|React\.forwardRef|forwardRef)/,
        /([A-Z]\w+)\s*=\s*\([^)]*\)\s*=>/,
        /export\s+(?:default\s+)?(?:function\s+)?([A-Z]\w+)/,
      ];

      componentPatterns.forEach(pattern => {
        const componentMatch = line.match(pattern);
        if (componentMatch) {
          symbols.push({
            name: componentMatch[1],
            type: 'component',
            line: lineIndex + 1,
            column:
              componentMatch.index +
              componentMatch[0].indexOf(componentMatch[1]),
          });
        }
      });

      // Variable declarations that might be components
      const varMatch = line.match(/(?:const|let|var)\s+([A-Z]\w+)\s*=/);
      if (varMatch) {
        symbols.push({
          name: varMatch[1],
          type: 'variable',
          line: lineIndex + 1,
          column: varMatch.index + varMatch[0].indexOf(varMatch[1]),
        });
      }

      // TypeScript type declarations (multiple patterns)
      const typePatterns = [
        /(?:export\s+)?type\s+(\w+)\s*=/, // type Foo = ...
        /(?:export\s+)?type\s+(\w+)\s*<[^>]*>\s*=/, // type Foo<T> = ...
      ];

      typePatterns.forEach(pattern => {
        const typeMatch = line.match(pattern);
        if (typeMatch) {
          symbols.push({
            name: typeMatch[1],
            type: 'type',
            line: lineIndex + 1,
            column: typeMatch.index + typeMatch[0].indexOf(typeMatch[1]),
          });
        }
      });

      // TypeScript interface declarations (multiple patterns)
      const interfacePatterns = [
        /(?:export\s+)?interface\s+(\w+)/, // interface Foo
        /(?:export\s+)?interface\s+(\w+)\s*<[^>]*>/, // interface Foo<T>
      ];

      interfacePatterns.forEach(pattern => {
        const interfaceMatch = line.match(pattern);
        if (interfaceMatch) {
          symbols.push({
            name: interfaceMatch[1],
            type: 'interface',
            line: lineIndex + 1,
            column:
              interfaceMatch.index +
              interfaceMatch[0].indexOf(interfaceMatch[1]),
          });
        }
      });

      // TypeScript enum declarations
      const enumMatch = line.match(/(?:export\s+)?enum\s+(\w+)/);
      if (enumMatch) {
        symbols.push({
          name: enumMatch[1],
          type: 'enum',
          line: lineIndex + 1,
          column: enumMatch.index + enumMatch[0].indexOf(enumMatch[1]),
        });
      }

      // TypeScript namespace declarations
      const namespaceMatch = line.match(/(?:export\s+)?namespace\s+(\w+)/);
      if (namespaceMatch) {
        symbols.push({
          name: namespaceMatch[1],
          type: 'namespace',
          line: lineIndex + 1,
          column:
            namespaceMatch.index + namespaceMatch[0].indexOf(namespaceMatch[1]),
        });
      }

      // TypeScript module declarations
      const moduleMatch = line.match(
        /(?:export\s+)?(?:declare\s+)?module\s+['"']([^'"']+)['"']/
      );
      if (moduleMatch) {
        symbols.push({
          name: moduleMatch[1],
          type: 'module',
          line: lineIndex + 1,
          column: moduleMatch.index + moduleMatch[0].indexOf(moduleMatch[1]),
        });
      }

      // Constants with type assertions (often used for defining types)
      const constAssertionMatch = line.match(
        /(?:export\s+)?const\s+(\w+)\s*=.*as\s+const/
      );
      if (constAssertionMatch) {
        symbols.push({
          name: constAssertionMatch[1],
          type: 'constant',
          line: lineIndex + 1,
          column:
            constAssertionMatch.index +
            constAssertionMatch[0].indexOf(constAssertionMatch[1]),
        });
      }
    });

    // Remove duplicates (same name, prefer 'component' type over others)
    const uniqueSymbols = [];
    const seen = new Set();

    // Sort by preference: component > function > class > interface > type > enum > namespace > variable
    const typeOrder = {
      component: 0,
      function: 1,
      class: 2,
      interface: 3,
      type: 4,
      enum: 5,
      namespace: 6,
      variable: 7,
    };
    symbols.sort((a, b) => {
      if (a.name === b.name) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      return 0;
    });

    symbols.forEach(symbol => {
      if (!seen.has(symbol.name)) {
        seen.add(symbol.name);
        uniqueSymbols.push(symbol);
      }
    });

    return uniqueSymbols;
  }
}
