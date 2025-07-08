import React, { useCallback, useState, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';

import CodeNode from './CodeNode';
import FilePicker from './FilePicker';
import { FileService } from '../services/fileService';

// Define custom node types
const nodeTypes = {
  codeNode: CodeNode,
};

const initialEdges = [];

function CodeCanvas({ initialFile, onFileProcessed }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [nextNodeId, setNextNodeId] = useState(1); // Start from 1
  const [hasInitialized, setHasInitialized] = useState(false); // Track if we've already created initial node

  // Create a stable reference for the symbol click handler
  const symbolClickHandlerRef = useRef(null);

  // Handle recentering on symbol in a node
  const handleRecenter = useCallback(
    (nodeId, focusLine, focusColumn) => {
      // Update the node to trigger a refocus
      setNodes(currentNodes => {
        return currentNodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                // Force a recenter by updating a timestamp that the editor can react to
                recenterTimestamp: Date.now(),
                focusLine: focusLine,
                focusColumn: focusColumn,
              },
            };
          }
          return node;
        });
      });
    },
    [setNodes]
  );

  // Handle closing nodes with cascading deletion
  const handleNodeClose = useCallback(
    nodeId => {
      // Function to recursively find all descendant nodes
      const findDescendantNodes = (parentNodeId, allNodes) => {
        const descendants = [];

        // Find direct children
        const directChildren = allNodes.filter(
          node => node.data.sourceNodeId === parentNodeId
        );

        // Add direct children to descendants
        descendants.push(...directChildren.map(node => node.id));

        // Recursively find children of children
        directChildren.forEach(child => {
          descendants.push(...findDescendantNodes(child.id, allNodes));
        });

        return descendants;
      };

      // Update nodes and edges together
      setNodes(currentNodes => {
        // Find all nodes that should be removed (the target node + all its descendants)
        const nodesToRemove = [
          nodeId,
          ...findDescendantNodes(nodeId, currentNodes),
        ];

        // Update edges to remove any connected to the nodes being removed
        setEdges(currentEdges => {
          return currentEdges.filter(
            edge =>
              !nodesToRemove.includes(edge.source) &&
              !nodesToRemove.includes(edge.target)
          );
        });

        // Remove all the nodes
        return currentNodes.filter(node => !nodesToRemove.includes(node.id));
      });
    },
    [setNodes, setEdges]
  );

  // Create a stable symbol click handler that doesn't change reference
  const createStableSymbolClickHandler = useCallback(nodeId => {
    return (symbolName, position, lineContent) => {
      if (symbolClickHandlerRef.current) {
        return symbolClickHandlerRef.current(nodeId)(
          symbolName,
          position,
          lineContent
        );
      }
    };
  }, []);

  // Handle symbol clicks to create definition boxes
  const handleSymbolClick = useCallback(
    sourceNodeId => async (symbolName, _position, _lineContent) => {
      // Get the current nodes and edges state directly from callbacks to avoid stale closures
      let sourceNode = null;
      let currentNodes = [];
      let currentEdges = [];

      setNodes(currentNodesState => {
        currentNodes = currentNodesState;
        sourceNode = currentNodesState.find(n => n.id === sourceNodeId);
        return currentNodesState; // Don't change the state here, just read it
      });

      setEdges(currentEdgesState => {
        currentEdges = currentEdgesState;
        return currentEdgesState; // Don't change the state here, just read it
      });

      if (!sourceNode) {
        console.error(`Source node ${sourceNodeId} not found`);
        return;
      }

      // Parse imports from the source file to find where this symbol comes from
      const sourceFilePath = sourceNode.data.filePath || initialFile;
      const imports = FileService.parseImports(
        sourceNode.data.code,
        sourceFilePath
      );

      // Find the import that contains this symbol
      const relevantImport = imports.find(imp => imp.symbol === symbolName);

      if (!relevantImport) {
        // Check if the symbol is defined locally in the same file
        const localSymbols = FileService.findSymbols(sourceNode.data.code);
        const localSymbol = localSymbols.find(s => s.name === symbolName);

        if (localSymbol) {
          // Handle local symbol by recentering on its definition in the same node
          handleRecenter(sourceNodeId, localSymbol.line, localSymbol.column);
          return;
        }

        return;
      }

      // Try to load the file that contains this symbol
      let targetFilePath = relevantImport.resolvedPath;

      // Only add extension if the resolved path doesn't already have one
      if (!targetFilePath.includes('.')) {
        // Add .jsx extension if it's likely a React component
        if (/^[A-Z]/.test(symbolName)) {
          targetFilePath += '.jsx';
        } else {
          targetFilePath += '.js';
        }
      }

      // Try to load the file with different extensions if needed
      let fileData = null;
      const possibleExtensions = [
        '.jsx',
        '.js',
        '.tsx',
        '.ts',
        '.json',
        '.scss',
        '.css',
      ];
      const baseTargetPath = targetFilePath.replace(/\.[^.]+$/, ''); // Remove extension if present

      // For paths that originally started with "~", also try src/ prefix
      const pathsToTry = [];

      // Add the main resolved path with all extensions
      for (const ext of possibleExtensions) {
        const pathToTry = targetFilePath.endsWith(ext)
          ? targetFilePath
          : baseTargetPath + ext;
        pathsToTry.push(pathToTry);
      }

      // If the original import started with "~", also try with "src/" prefix
      if (relevantImport.from.startsWith('~')) {
        const srcBasePath = 'src/' + baseTargetPath;
        for (const ext of possibleExtensions) {
          const pathToTry = targetFilePath.endsWith(ext)
            ? 'src/' + targetFilePath
            : srcBasePath + ext;
          pathsToTry.push(pathToTry);
        }
      }

      // Remove duplicates
      const uniquePaths = [...new Set(pathsToTry)];

      for (const pathToTry of uniquePaths) {
        try {
          fileData = await FileService.loadFile(pathToTry);
          targetFilePath = pathToTry; // Update to the successful path
          break;
        } catch (error) {
          // Continue to next path
        }
      }

      if (!fileData) {
        return;
      }
      const symbols = FileService.findSymbols(fileData.content);
      const targetSymbol = symbols.find(s => s.name === symbolName);

      if (!targetSymbol) {
        return;
      }

      // Check if a node for this symbol already exists (use currentNodes, not stale nodes)
      const existingNode = currentNodes.find(
        node =>
          node.data.symbolName === symbolName &&
          node.data.sourceNodeId === sourceNodeId
      );

      if (existingNode) {
        return;
      }

      // Also check for existing edges to prevent duplicates
      const existingEdge = currentEdges.find(
        edge => edge.source === sourceNodeId && edge.label === symbolName
      );

      if (existingEdge) {
        return;
      }

      // Create new node for the definition
      const newNodeId = nextNodeId.toString();
      setNextNodeId(prev => prev + 1);

      // Calculate position for horizontal tree layout
      // Count existing children of this source node to stack them vertically (use currentNodes)
      const existingChildren = currentNodes.filter(
        node => node.data.sourceNodeId === sourceNodeId
      ).length;

      // Calculate depth of source node (how many levels deep it is)
      let _sourceDepth = 0;
      let current = sourceNode;
      while (current && current.data.sourceNodeId) {
        _sourceDepth++;
        current = currentNodes.find(n => n.id === current.data.sourceNodeId);
      }

      // Position new nodes horizontally to the right and slightly above
      // Calculate proper spacing based on source node content width (max 1000px like CodeNode)
      const sourceLines = sourceNode.data.code.split('\n');
      const sourceMaxLineLength = Math.max(
        ...sourceLines.map(line => line.length)
      );
      const estimatedSourceWidth = Math.min(
        1000,
        Math.max(400, sourceMaxLineLength * 8 + 80)
      );

      // Add extra margin for comfortable spacing (minimum 150px gap)
      const baseGap = 150;
      const horizontalSpacing = estimatedSourceWidth + baseGap;
      const verticalSpacing = 200; // More space between sibling nodes
      const verticalOffset = -80; // Move up more to center better

      const newPosition = {
        x: sourceNode.position.x + horizontalSpacing,
        y:
          sourceNode.position.y +
          verticalOffset +
          existingChildren * verticalSpacing,
      };

      const fileName = targetFilePath.split('/').pop();
      const language = FileService.getLanguageFromPath(targetFilePath);

      const newNode = {
        id: newNodeId,
        type: 'codeNode',
        position: newPosition,
        data: {
          label: `${fileName} - ${symbolName}`,
          code: fileData.content,
          language: language,
          isCloseable: true,
          symbolName: symbolName,
          sourceNodeId: sourceNodeId,
          filePath: targetFilePath,
          focusLine: targetSymbol.line,
          focusColumn: targetSymbol.column,
          onSymbolClick: createStableSymbolClickHandler(newNodeId),
          onClose: () => handleNodeClose(newNodeId),
          onRecenter: () =>
            handleRecenter(newNodeId, targetSymbol.line, targetSymbol.column),
        },
      };

      // Create edge with unique ID
      const edgeId = `edge-${sourceNodeId}-${newNodeId}-${Date.now()}`;
      const newEdge = {
        id: edgeId,
        source: sourceNodeId,
        sourceHandle: 'right',
        target: newNodeId,
        targetHandle: 'left',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        label: symbolName,
        labelStyle: { fill: '#3b82f6', fontWeight: 600 },
      };

      setNodes(currentNodes => [...currentNodes, newNode]);
      setEdges(currentEdges => [...currentEdges, newEdge]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      setNodes,
      setEdges,
      nextNodeId,
      setNextNodeId,
      initialFile,
      handleRecenter,
      handleNodeClose,
    ]
  );

  // Update the ref to point to the current handler
  symbolClickHandlerRef.current = handleSymbolClick;

  // Function to add a new main context node
  const addNewMainContext = useCallback(
    async filePath => {
      try {
        const fileData = await FileService.loadFile(filePath);
        const symbols = FileService.findSymbols(fileData.content);
        const language = FileService.getLanguageFromPath(filePath);

        // Find a good focus point (first import or main function)
        let focusLine = 0;
        let focusColumn = 0;
        const reactImport = symbols.find(s => s.name === 'React');
        if (reactImport) {
          focusLine = reactImport.line;
          focusColumn = reactImport.column;
        }

        // Calculate position for new main context
        // Place it below existing main contexts
        const newX = 50; // Start position horizontally
        let newY = 200; // Start position vertically

        // Get current nodes state to avoid stale closure
        let currentNodes = [];
        setNodes(currentNodesState => {
          currentNodes = currentNodesState;
          return currentNodesState; // Don't change the state here, just read it
        });

        // Find main context nodes (nodes without sourceNodeId)
        const mainContextNodes = currentNodes.filter(
          node => !node.data.sourceNodeId
        );

        if (mainContextNodes.length > 0) {
          // Position below the lowest main context node with proper spacing
          const maxY = Math.max(
            ...mainContextNodes.map(node => node.position.y)
          );
          newY = maxY + 600; // Add enough vertical space to avoid overlap (typical node height ~400-500px)
        }

        const fileName = filePath.split('/').pop();
        const nodeId = nextNodeId.toString();

        const newMainContextNode = {
          id: nodeId,
          type: 'codeNode',
          position: { x: newX, y: newY },
          data: {
            label: fileName,
            code: fileData.content,
            language: language,
            filePath: filePath,
            isCloseable: true, // Main contexts can now be closed
            onSymbolClick: createStableSymbolClickHandler(nodeId),
            onClose: () => handleNodeClose(nodeId),
            focusLine: focusLine,
            focusColumn: focusColumn,
          },
        };

        setNodes(currentNodes => [...currentNodes, newMainContextNode]);
        setNextNodeId(prev => prev + 1);
        setHasInitialized(true); // Mark as initialized
        setShowFilePicker(false);
      } catch (error) {
        console.error(`Failed to load file ${filePath}:`, error);
        setShowFilePicker(false);
      }
    },
    [
      nextNodeId,
      createStableSymbolClickHandler,
      handleNodeClose,
      setNodes,
      setHasInitialized,
    ]
  );

  // Initialize the canvas with the first node
  React.useEffect(() => {
    if (nodes.length === 0 && initialFile && !hasInitialized) {
      // Use the addNewMainContext function to create the initial node
      addNewMainContext(initialFile);
      // Notify parent that file has been processed
      if (onFileProcessed) {
        onFileProcessed(initialFile);
      }
    }
  }, [
    nodes.length,
    initialFile,
    addNewMainContext,
    hasInitialized,
    onFileProcessed,
  ]);

  // Handle new files from CodeGlimpse (even when canvas already has nodes)
  React.useEffect(() => {
    if (initialFile && hasInitialized) {
      // Check if this file is already open as a main context
      const isFileAlreadyOpen = nodes.some(
        node => !node.data.sourceNodeId && node.data.filePath === initialFile
      );

      if (!isFileAlreadyOpen) {
        addNewMainContext(initialFile);
        // Notify parent that file has been processed
        if (onFileProcessed) {
          onFileProcessed(initialFile);
        }
      } else {
        // Still notify parent that file has been processed (even if skipped)
        if (onFileProcessed) {
          onFileProcessed(initialFile);
        }
      }
    }
  }, [initialFile, addNewMainContext, hasInitialized, nodes, onFileProcessed]);

  // Function to handle opening file picker
  const handleAddNewContext = () => {
    setShowFilePicker(true);
  };

  // Check if we need to show the add button when no main contexts exist
  const hasMainContexts = nodes.some(node => !node.data.sourceNodeId);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50 dark:bg-gray-900"
        connectOnClick={false}
        connectionMode="loose"
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Controls className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600" />
        <MiniMap className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600" />
        <Background
          variant="dots"
          gap={12}
          size={1}
          className="dark:opacity-30"
        />
      </ReactFlow>

      {/* Empty state when no main contexts */}
      {!hasMainContexts && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-lg mb-2">No files open</p>
            <p className="text-sm">
              Click the + button to add a file to explore
            </p>
          </div>
        </div>
      )}

      {/* Floating Add Context Button - always show */}
      <button
        onClick={handleAddNewContext}
        className="absolute left-4 top-4 z-10 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
        title="Add new main context"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* File picker modal */}
      {showFilePicker && (
        <div className="absolute inset-0 z-20">
          <FilePicker
            onFileSelect={addNewMainContext}
            onCancel={() => setShowFilePicker(false)}
          />
        </div>
      )}
    </div>
  );
}

export default CodeCanvas;
