import React from 'react';
import ThemeSwitcher from './ThemeSwitcher';

const Menu = ({ selectedTool, onToolSelect }) => {
  const tools = [
    { id: 'code-glimpse', name: 'Code Glimpse' },
    { id: 'code-canvas', name: 'Code Canvas' },
    // Add more tools here in the future
  ];

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 flex flex-col justify-between">
      <div>
        <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
          Tools
        </h2>
        <ul className="space-y-2">
          {tools.map(tool => (
            <li key={tool.id}>
              <button
                onClick={() => onToolSelect(tool.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  selectedTool === tool.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                }`}
              >
                {tool.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <ThemeSwitcher />
    </div>
  );
};

export default Menu;
