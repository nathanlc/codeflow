import React, { useState, useCallback, useEffect } from 'react';
import RepositorySelector from './RepositorySelector';
import CodeCanvas from './CodeCanvas';
import Menu from './Menu';
import CodeGlimpse from './CodeGlimpse';

const MainView = () => {
  const [repository, setRepository] = useState(null);
  const [showRepositorySelector, setShowRepositorySelector] = useState(false);
  const [selectedTool, setSelectedTool] = useState('code-glimpse');
  const [codeCanvasInitialFile, setCodeCanvasInitialFile] = useState(null);

  // Handle opening file in Code Canvas from CodeGlimpse
  const handleOpenInCodeCanvas = useCallback(filePath => {
    setCodeCanvasInitialFile(filePath);
    setSelectedTool('code-canvas');
  }, []);

  // Handle when CodeCanvas has processed a file
  const handleFileProcessed = useCallback(() => {
    setCodeCanvasInitialFile(null);
  }, []);

  useEffect(() => {
    const loadCurrentRepository = async () => {
      try {
        const response = await fetch('/api/repository/current');
        if (response.ok) {
          const repoData = await response.json();
          setRepository(repoData);
        } else {
          setShowRepositorySelector(true);
        }
      } catch (error) {
        console.error('Failed to load current repository:', error);
        setShowRepositorySelector(true);
      }
    };

    loadCurrentRepository();
  }, []);

  const handleRepositoryChange = useCallback(repo => {
    setRepository(repo);
    setShowRepositorySelector(false);
  }, []);

  const handleCancel = useCallback(() => {
    setShowRepositorySelector(false);
  }, []);

  const handleOpenRepository = () => {
    setShowRepositorySelector(true);
  };

  if (showRepositorySelector || !repository) {
    return (
      <RepositorySelector
        currentRepository={repository}
        onRepositoryChange={handleRepositoryChange}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Repository Header */}
      {repository && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <div>
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {repository.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {repository.path}
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenRepository}
            className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
          >
            Change Directory
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1">
        <Menu selectedTool={selectedTool} onToolSelect={setSelectedTool} />
        <div className="flex-1">
          {/* Always render both components but hide/show them with CSS to preserve state */}
          <div
            className={`h-full ${selectedTool === 'code-glimpse' ? 'block' : 'hidden'}`}
          >
            <CodeGlimpse onOpenInCodeCanvas={handleOpenInCodeCanvas} />
          </div>
          <div
            className={`h-full ${selectedTool === 'code-canvas' ? 'block' : 'hidden'}`}
          >
            <CodeCanvas
              initialFile={codeCanvasInitialFile}
              onFileProcessed={handleFileProcessed}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainView;
