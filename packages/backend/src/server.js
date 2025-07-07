import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ignore from 'ignore';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../'); // Go up to codeflow root

// API endpoint to get file contents
app.get('/api/file/*', (req, res) => {
  try {
    // Extract file path from URL (everything after /api/file/)
    const filePath = req.params[0];

    // Security: only allow files within the current working directory
    const fullPath = path.resolve(currentRepositoryPath, filePath);
    if (!fullPath.startsWith(currentRepositoryPath)) {
      return res
        .status(403)
        .json({ error: 'Access denied: path outside working directory' });
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Read file content
    const content = fs.readFileSync(fullPath, 'utf-8');
    const stats = fs.statSync(fullPath);

    res.json({
      path: filePath,
      content: content,
      size: stats.size,
      modified: stats.mtime,
    });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// API endpoint to get all project files
app.get('/api/files', (req, res) => {
  try {
    const getAllFiles = (dirPath, relativePath = '') => {
      const files = [];
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativeFilePath = relativePath
          ? `${relativePath}/${item}`
          : item;

        // Skip node_modules, .git, and other common ignore patterns
        if (
          item === 'node_modules' ||
          item === '.git' ||
          item.startsWith('.') ||
          item === 'dist' ||
          item === 'build'
        ) {
          continue;
        }

        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          files.push(...getAllFiles(fullPath, relativeFilePath));
        } else {
          // Only include common code file extensions
          const ext = path.extname(item).toLowerCase();
          const validExtensions = [
            '.js',
            '.jsx',
            '.ts',
            '.tsx',
            '.py',
            '.java',
            '.cpp',
            '.c',
            '.cs',
            '.go',
            '.rs',
            '.php',
            '.rb',
            '.swift',
            '.kt',
            '.dart',
            '.html',
            '.css',
            '.scss',
            '.less',
            '.json',
            '.xml',
            '.yaml',
            '.yml',
            '.md',
            '.sh',
            '.sql',
          ];

          if (
            validExtensions.includes(ext) ||
            item === 'package.json' ||
            item === 'README.md'
          ) {
            files.push({
              path: relativeFilePath,
              name: item,
              size: stats.size,
              modified: stats.mtime,
            });
          }
        }
      }

      return files;
    };

    const allFiles = getAllFiles(currentRepositoryPath);
    res.json({ files: allFiles });
  } catch (error) {
    console.error('Error getting files:', error);
    res.status(500).json({ error: 'Failed to get project files' });
  }
});

// API routes for code analysis
app.post('/api/analyze', (req, res) => {
  // TODO: Implement Tree-sitter parsing and LSP integration
  // For now, return mock data
  const mockResponse = {
    symbols: [
      { name: 'hello', type: 'function', range: [0, 2] },
      { name: 'greet', type: 'function', range: [2, 2] },
    ],
    dependencies: [],
  };

  res.json(mockResponse);
});

app.post('/api/goto-definition', (req, res) => {
  // TODO: Implement LSP go-to-definition
  // For now, return mock data
  const mockResponse = {
    file: 'utils.js',
    position: { line: 5, character: 0 },
    code: `function greet(name) {
  const greeting = "Hello, " + name;
  return greeting;
}`,
  };

  res.json(mockResponse);
});

// Directory management
let currentRepositoryPath = projectRoot; // Default to current project

// API endpoint to validate and set local directory path
app.post('/api/repository/validate', (req, res) => {
  try {
    const { path: repoPath } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    // Resolve the path
    const fullPath = path.resolve(repoPath);

    // Check if directory exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    // Check if it's a directory
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    // Get directory name for display
    const name = path.basename(fullPath);

    // Update current repository path
    currentRepositoryPath = fullPath;

    res.json({
      path: fullPath,
      name: name,
      type: 'local',
      valid: true,
    });
  } catch (error) {
    console.error('Directory validation error:', error);
    res.status(500).json({ error: 'Failed to validate directory path' });
  }
});

// API endpoint to get current directory info
app.get('/api/repository/current', (req, res) => {
  try {
    const name = path.basename(currentRepositoryPath);
    res.json({
      path: currentRepositoryPath,
      name: name,
      type: 'local',
    });
  } catch (error) {
    console.error('Error getting current directory:', error);
    res.status(500).json({ error: 'Failed to get directory info' });
  }
});

// API endpoint for Code Glimpse data
app.get('/api/repository/glimpse-data', (req, res) => {
  try {
    const { ignore: customIgnoreRules } = req.query;
    const ig = ignore();

    // Add rules from .gitignore
    const findGitIgnore = startPath => {
      let currentPath = startPath;
      while (currentPath !== path.parse(currentPath).root) {
        const gitignorePath = path.join(currentPath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const content = fs.readFileSync(gitignorePath, 'utf-8');
          ig.add(content);
          return;
        }
        currentPath = path.dirname(currentPath);
      }
    };
    findGitIgnore(currentRepositoryPath);

    // Add custom rules from the frontend
    if (customIgnoreRules) {
      try {
        const rules = customIgnoreRules
          .split(';')
          .map(s => s.trim())
          .filter(Boolean);
        ig.add(rules);
      } catch (e) {
        return res
          .status(400)
          .json({ error: 'Invalid ignore rules', details: e.message });
      }
    }

    const getDirectoryStructure = (dirPath, relativePath = '') => {
      const structure = {
        name: path.basename(dirPath),
        path: relativePath || '.',
        children: [],
      };

      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemRelativePath = path.join(relativePath, item);

        if (ig.ignores(itemRelativePath)) {
          continue;
        }

        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          structure.children.push(
            getDirectoryStructure(fullPath, itemRelativePath)
          );
        } else {
          // Filter out hidden files, README files, and other non-code files
          if (
            item.startsWith('.') ||
            item.toLowerCase().startsWith('readme') ||
            item.toLowerCase() === 'license' ||
            item.toLowerCase() === 'changelog' ||
            item.toLowerCase() === 'changelog.md' ||
            item.toLowerCase() === 'contributing.md'
          ) {
            continue;
          }

          // Only include common code file extensions
          const ext = path.extname(item).toLowerCase();
          const validExtensions = [
            '.js',
            '.jsx',
            '.ts',
            '.tsx',
            '.py',
            '.java',
            '.cpp',
            '.c',
            '.cs',
            '.go',
            '.rs',
            '.php',
            '.rb',
            '.swift',
            '.kt',
            '.dart',
            '.html',
            '.css',
            '.scss',
            '.less',
            '.json',
            '.xml',
            '.yaml',
            '.yml',
            '.sh',
            '.sql',
          ];

          if (validExtensions.includes(ext)) {
            structure.children.push({
              name: item,
              path: itemRelativePath,
              size: stats.size,
            });
          }
        }
      }

      // Add size to directories based on children
      structure.size = structure.children.reduce(
        (acc, child) => acc + (child.size || 0),
        0
      );

      return structure;
    };

    const structure = getDirectoryStructure(currentRepositoryPath);
    res.json(structure);
  } catch (error) {
    console.error('Error getting directory structure:', error);
    res.status(500).json({ error: 'Failed to get directory structure' });
  }
});

// WebSocket handling for real-time updates
wss.on('connection', ws => {
  console.log('Client connected');

  ws.on('message', message => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);

      // Echo back for now
      ws.send(JSON.stringify({ type: 'ack', data }));
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`CodeFlow backend server running on port ${PORT}`);
});
