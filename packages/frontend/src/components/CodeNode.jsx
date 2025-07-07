import React, { memo, useRef, useCallback, useState, useContext } from 'react';
import { Handle, Position } from 'reactflow';
import { Resizable } from 'react-resizable';
import Editor from '@monaco-editor/react';
import { ThemeContext } from '../contexts/ThemeContext';
import 'react-resizable/css/styles.css';

function CodeNode({ data }) {
  const { theme } = useContext(ThemeContext);
  const {
    label,
    code,
    language = 'javascript',
    isCloseable = true,
    onSymbolClick,
    onClose,
    focusLine,
    focusColumn: _focusColumn,
    onRecenter,
    recenterTimestamp,
  } = data;
  const editorRef = useRef(null);

  // Calculate initial editor dimensions based on content and focus
  const lines = code.split('\n');
  const maxLineLength = Math.max(...lines.map(line => line.length));

  // Calculate height based on focus line or content
  let editorHeight;
  if (focusLine !== undefined) {
    // Show enough lines to see the focused symbol with some context
    const contextLines = 10; // Lines of context above and below
    const visibleLines = Math.min(lines.length, contextLines * 2 + 5);
    editorHeight = Math.min(600, Math.max(200, visibleLines * 19 + 10));
  } else {
    // Default behavior - size based on content
    editorHeight = Math.min(600, Math.max(100, lines.length * 19 + 10));
  }

  const headerHeight = 40; // Height of the header
  const initialHeight = editorHeight + headerHeight; // Total height including header
  const initialWidth = Math.min(1000, Math.max(400, maxLineLength * 8 + 80)); // ~8px per character + padding, max 1000px

  // State for resizable dimensions
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight,
  });

  // Function to recenter the editor on the focus line
  const recenterEditor = useCallback(() => {
    if (editorRef.current && focusLine !== undefined) {
      const editor = editorRef.current;
      const monaco = window.monaco;

      setTimeout(() => {
        // Scroll to the focus line
        editor.revealLineInCenter(focusLine + 1); // Monaco uses 1-based line numbers

        // Highlight the focused line
        const range = new monaco.Range(focusLine + 1, 1, focusLine + 1, 1);
        editor.setSelection(range);

        // Add a temporary highlight decoration
        const decorations = editor.deltaDecorations(
          [],
          [
            {
              range: new monaco.Range(
                focusLine + 1,
                1,
                focusLine + 1,
                lines[focusLine]?.length || 1
              ),
              options: {
                isWholeLine: true,
                className: 'focused-line',
                glyphMarginClassName: 'focused-line-glyph',
              },
            },
          ]
        );

        // Remove highlight after 3 seconds
        setTimeout(() => {
          editor.deltaDecorations(decorations, []);
        }, 3000);
      }, 100);
    }
  }, [focusLine, lines]);

  // React to recenter requests
  React.useEffect(() => {
    if (recenterTimestamp) {
      recenterEditor();
    }
  }, [recenterTimestamp, recenterEditor]);

  const handleResize = useCallback((event, { size }) => {
    event.stopPropagation(); // Prevent React Flow from handling this event
    event.preventDefault();
    setDimensions({
      width: size.width,
      height: size.height,
    });
  }, []);

  const handleResizeStart = useCallback(event => {
    event.stopPropagation(); // Prevent React Flow from starting drag
    event.preventDefault();
  }, []);

  const handleResizeStop = useCallback(event => {
    event.stopPropagation(); // Prevent React Flow from handling this event
    event.preventDefault();
  }, []);

  // Handle mouse events on resize handle to prevent React Flow interference
  const handleMouseDown = useCallback(event => {
    // Check if this is a resize handle click or any of its child elements
    const target = event.target;
    const isResizeHandle =
      target.classList.contains('react-resizable-handle') ||
      target.closest('.react-resizable-handle');

    if (isResizeHandle) {
      console.log('Resize handle clicked, preventing React Flow interference');
      event.stopPropagation();
      event.preventDefault();

      // Temporarily disable node dragging during resize
      const nodeElement = event.currentTarget;
      nodeElement.classList.add('nodrag');

      // Re-enable dragging after a short delay
      setTimeout(() => {
        nodeElement.classList.remove('nodrag');
      }, 100);
    }
  }, []);

  const handleEditorDidMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      console.log('Editor mounted, onSymbolClick:', !!onSymbolClick);

      // Make monaco available globally for recenterEditor
      window.monaco = monaco;

      // Focus on specific line if provided (initial focus)
      if (focusLine !== undefined) {
        recenterEditor();
      }

      // Add click handler for symbol navigation using the editor's built-in event
      editor.onDidChangeCursorPosition(e => {
        // Only handle if this was triggered by a mouse click
        if (e.source === 'mouse' && onSymbolClick) {
          const position = e.position;
          const model = editor.getModel();
          const word = model.getWordAtPosition(position);

          if (word) {
            const lineContent = model.getLineContent(position.lineNumber);
            const wordText = word.word;
            console.log(
              'Cursor changed to word:',
              wordText,
              'in line:',
              lineContent
            );

            // Simple heuristic to detect symbols we want to navigate to
            if (isNavigableSymbol(wordText, lineContent, word)) {
              console.log('Navigable symbol at cursor:', wordText);
              // Small delay to distinguish from regular cursor movements
              setTimeout(() => {
                onSymbolClick(wordText, position, lineContent);
              }, 100);
            }
          }
        }
      });

      // Also try the direct mouse click approach
      editor.onMouseUp(e => {
        console.log('Mouse up event:', e.target.type, e.target.position);
        if (
          e.target.type === monaco.editor.MouseTargetType.CONTENT_TEXT &&
          e.target.position &&
          onSymbolClick
        ) {
          const position = e.target.position;
          const model = editor.getModel();
          const word = model.getWordAtPosition(position);

          if (word) {
            const lineContent = model.getLineContent(position.lineNumber);
            const wordText = word.word;
            console.log('Direct click on word:', wordText);

            if (isNavigableSymbol(wordText, lineContent, word)) {
              console.log('Direct navigable symbol clicked:', wordText);
              onSymbolClick(wordText, position, lineContent);
            }
          }
        }
      });

      // Add hover effects for navigable symbols
      editor.onMouseMove(e => {
        const position = e.target.position;
        if (position) {
          const model = editor.getModel();
          const word = model.getWordAtPosition(position);

          if (
            word &&
            isNavigableSymbol(
              word.word,
              model.getLineContent(position.lineNumber),
              word
            )
          ) {
            editor.updateOptions({ 'hover.enabled': true });
            document.body.style.cursor = 'pointer';
          } else {
            document.body.style.cursor = 'default';
          }
        }
      });
    },
    [onSymbolClick, focusLine, recenterEditor]
  );

  // Helper function to determine if a word is a navigable symbol
  const isNavigableSymbol = (word, lineContent, wordInfo) => {
    // Skip keywords and operators
    const keywords = [
      'function',
      'const',
      'let',
      'var',
      'if',
      'else',
      'for',
      'while',
      'return',
      'class',
      'import',
      'export',
      'from',
    ];
    if (keywords.includes(word)) return false;

    // Look for JSX components (capitalized words in JSX context)
    if (/^[A-Z]/.test(word) && lineContent.includes('<')) {
      console.log(
        `Found potential JSX component: ${word} in line: ${lineContent}`
      );
      return true;
    }

    // Look for function calls (word followed by parentheses)
    const wordEnd = wordInfo.startColumn + word.length - 1;
    const remainingLine = lineContent.substring(wordEnd);
    if (remainingLine.trim().startsWith('(')) {
      console.log(`Found function call: ${word}`);
      return true;
    }

    // Look for variable/property references (but exclude common HTML tags)
    const htmlTags = [
      'div',
      'span',
      'p',
      'a',
      'img',
      'button',
      'input',
      'form',
    ];
    if (
      word.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/) &&
      !htmlTags.includes(word.toLowerCase())
    ) {
      console.log(`Found potential symbol: ${word}`);
      return true;
    }

    return false;
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <Resizable
        width={dimensions.width}
        height={dimensions.height}
        onResize={handleResize}
        onResizeStart={handleResizeStart}
        onResizeStop={handleResizeStop}
        minConstraints={[250, 120]} // Increased minimum height to account for header
        maxConstraints={[1200, 640]} // Increased to account for header (600 + 40)
        resizeHandles={['se']} // Only show resize handle in bottom-right corner
        handle={(axis, ref) => (
          <div
            ref={ref}
            className={`react-resizable-handle react-resizable-handle-${axis} nodrag`}
            onMouseDown={e => {
              console.log('Resize handle mouse down');
              e.stopPropagation();
            }}
            style={{
              pointerEvents: 'auto',
              zIndex: 1001,
            }}
          />
        )}
      >
        <div
          className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Header */}
          <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-300 dark:border-gray-600 rounded-t-lg flex justify-between items-center">
            {onRecenter ? (
              <h3
                className="font-semibold text-gray-800 dark:text-gray-200 text-sm whitespace-nowrap cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline nodrag"
                onClick={e => {
                  e.stopPropagation();
                  onRecenter();
                }}
                title="Click to recenter on symbol"
              >
                {label}
              </h3>
            ) : (
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm whitespace-nowrap">
                {label}
              </h3>
            )}
            {isCloseable && onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-lg font-bold leading-none"
                title="Close"
              >
                ×
              </button>
            )}
          </div>

          {/* Code Content */}
          <div
            className="p-0 nodrag"
            style={{ height: dimensions.height - headerHeight }}
          >
            {' '}
            {/* Subtract header height */}
            <Editor
              height={`${dimensions.height - headerHeight}px`}
              width={`${dimensions.width}px`}
              language={language}
              value={code}
              theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
              onMount={handleEditorDidMount}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12,
                lineNumbers: 'on',
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
                renderLineHighlight: 'none',
                wordWrap: 'off',
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'auto',
                },
                hover: {
                  enabled: true,
                  delay: 300,
                },
              }}
            />
          </div>

          {/* React Flow Handles - completely invisible but functional for programmatic connections */}
          <Handle
            type="target"
            position={Position.Top}
            id="top"
            isConnectable={false}
            style={{ opacity: 0, pointerEvents: 'none' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="bottom"
            isConnectable={false}
            style={{ opacity: 0, pointerEvents: 'none' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            isConnectable={false}
            style={{ opacity: 0, pointerEvents: 'none' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            isConnectable={false}
            style={{ opacity: 0, pointerEvents: 'none' }}
          />
        </div>
      </Resizable>
    </div>
  );
}

export default memo(CodeNode);
