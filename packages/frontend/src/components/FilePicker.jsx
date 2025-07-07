import React, { useState, useEffect, useRef, useCallback } from 'react';

const FilePicker = ({ onFileSelect, onCancel }) => {
  const [allFiles, setAllFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    loadProjectFiles();
  }, []);

  useEffect(() => {
    // Focus search input when component mounts
    // Use setTimeout to ensure DOM is ready and prevent any race conditions
    const focusTimer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(focusTimer);
  }, []);

  // Add global escape key handler as backup
  useEffect(() => {
    const handleEscapeKey = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    // Add event listener to document to catch escape anywhere
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onCancel]);

  // Fuzzy filtering algorithm similar to VS Code
  const fuzzyFilter = useCallback((files, query) => {
    const queryLower = query.toLowerCase();

    const calculateFuzzyScore = (text, queryText) => {
      let score = 0;
      let textIndex = 0;

      for (let i = 0; i < queryText.length; i++) {
        const char = queryText[i];
        const foundIndex = text.indexOf(char, textIndex);

        if (foundIndex === -1) {
          return 0; // Character not found
        }

        // Bonus for consecutive characters
        if (foundIndex === textIndex) {
          score += 2;
        } else {
          score += 1;
        }

        textIndex = foundIndex + 1;
      }

      return score;
    };

    return files
      .map(file => {
        const fileName = file.name.toLowerCase();
        const filePath = file.path.toLowerCase();

        // Calculate score based on various factors
        let score = 0;

        // Exact filename match gets highest priority
        if (fileName.includes(queryLower)) {
          score += 100;
          // Bonus for starting with query
          if (fileName.startsWith(queryLower)) {
            score += 50;
          }
        }

        // Path match gets medium priority
        if (filePath.includes(queryLower)) {
          score += 50;
        }

        // Fuzzy match on filename
        const fuzzyScore = calculateFuzzyScore(fileName, queryLower);
        score += fuzzyScore;

        // Bonus for common file types
        if (
          file.name.endsWith('.jsx') ||
          file.name.endsWith('.js') ||
          file.name.endsWith('.ts') ||
          file.name.endsWith('.tsx')
        ) {
          score += 10;
        }

        return { ...file, score };
      })
      .filter(file => file.score > 0)
      .sort((a, b) => b.score - a.score);
  }, []);

  useEffect(() => {
    // Filter files based on search query
    if (!searchQuery.trim()) {
      setFilteredFiles(allFiles.slice(0, 50)); // Show first 50 files when no search
    } else {
      const filtered = fuzzyFilter(allFiles, searchQuery);
      setFilteredFiles(filtered.slice(0, 20)); // Show top 20 matches
    }
    setSelectedIndex(0); // Reset selection when filter changes
  }, [searchQuery, allFiles, fuzzyFilter]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredFiles.length > 0) {
      const selectedElement =
        listRef.current.children[0]?.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedIndex, filteredFiles.length]);

  const loadProjectFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/files');
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setAllFiles(data.files || []);
    } catch (err) {
      setError('Failed to load project files');
      console.error('Error loading files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredFiles.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredFiles[selectedIndex]) {
        handleFileSelect(filteredFiles[selectedIndex].path);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleFileSelect = filePath => {
    onFileSelect(filePath);
  };

  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span
          key={index}
          className="bg-yellow-200 dark:bg-yellow-600 text-gray-900 dark:text-gray-100"
        >
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Loading project files...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Error Loading Files
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={loadProjectFiles}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900 p-4"
      onClick={e => {
        // Focus input when clicking on the modal background
        if (e.target === e.currentTarget && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }}
      onKeyDown={e => {
        // Handle escape at modal level as backup
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      tabIndex={-1} // Make div focusable to capture keyboard events
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-3xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Go to File
          </h1>

          {/* Search Input */}
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Start typing to search files..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="absolute right-3 top-2.5 text-sm text-gray-400 dark:text-gray-500">
              ↑↓ navigate • ↵ select • esc cancel
            </div>
          </div>
        </div>

        {/* File List */}
        <div className="max-h-96 overflow-y-auto" ref={listRef}>
          {filteredFiles.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {searchQuery.trim()
                ? 'No files match your search'
                : 'No files found'}
            </div>
          ) : (
            <div className="py-2">
              {filteredFiles.map((file, index) => (
                <div
                  key={file.path}
                  className={`px-4 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/50 border-l-2 border-blue-500'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => handleFileSelect(file.path)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {highlightMatch(file.name, searchQuery)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {highlightMatch(file.path, searchQuery)}
                    </div>
                  </div>

                  {/* File extension indicator */}
                  <div className="ml-2 flex-shrink-0">
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                      {file.name.includes('.')
                        ? file.name.split('.').pop().toUpperCase()
                        : 'FILE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
          <div>
            {filteredFiles.length > 0 && (
              <span>
                {filteredFiles.length} file
                {filteredFiles.length !== 1 ? 's' : ''} found
              </span>
            )}
          </div>
          <button
            onClick={onCancel}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilePicker;
