import React from 'react';
import MainView from './components/MainView';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <div className="h-full w-full bg-white dark:bg-gray-900 transition-colors duration-200">
        <MainView />
      </div>
    </ThemeProvider>
  );
}

export default App;
