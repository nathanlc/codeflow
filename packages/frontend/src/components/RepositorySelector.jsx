import React, { useState, useRef, useEffect } from 'react';

const RepositorySelector = ({
  currentRepository,
  onRepositoryChange,
  onCancel,
}) => {
  const [localPath, setLocalPath] = useState(currentRepository?.path || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus the input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handlePathChange = e => {
    setLocalPath(e.target.value);
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!localPath.trim()) {
      setError('Please enter a local directory path');
      return;
    }

    await validateAndSetRepository(localPath.trim());
  };

  const validateAndSetRepository = async path => {
    setLoading(true);
    setError('');

    try {
      // Validate the repository path with the backend
      const response = await fetch('/api/repository/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid directory path');
      }

      const repositoryData = await response.json();

      onRepositoryChange({
        path: path,
        name: repositoryData.name,
        type: 'local',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-600">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Browse Local Directory
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select a local folder containing your code to explore
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Path Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Local Directory Path
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Enter the full path to your code directory (e.g.,
                /Users/yourname/projects/myproject)
              </p>
              <input
                type="text"
                ref={inputRef}
                value={localPath}
                onChange={handlePathChange}
                placeholder="/Users/yourname/path/to/code"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            {/* Current Directory Info */}
            {currentRepository && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Current:</strong> {currentRepository.name}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {currentRepository.path}
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {loading ? 'Validating...' : 'Open Directory'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RepositorySelector;
