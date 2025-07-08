import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import * as d3 from 'd3';
import { ThemeContext } from '../contexts/ThemeContext';

const CodeGlimpse = ({ onOpenInCodeCanvas }) => {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('');
  const [ignore, setIgnore] = useState(
    'package-lock.json;**/*.snap;dist/;.git;.git/;.github/;.github;.vscode/;.vscode;.env'
  );
  const [pendingIgnore, setPendingIgnore] = useState(ignore);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const { theme } = useContext(ThemeContext);
  const svgRef = useRef();

  const fetchData = useCallback(() => {
    const encodedIgnore = encodeURIComponent(ignore);
    fetch(`/api/repository/glimpse-data?ignore=${encodedIgnore}`)
      .then(async response => {
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to fetch data');
        }
        return response.json();
      })
      .then(data => {
        setData(data);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
        setData(null);
      });
  }, [ignore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getFileColor = fileName => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      // Web Technologies (Warm Gradient: Gold → Orange → Coral)
      case 'js':
      case 'ts':
        return '#fbbf24'; // JavaScript/TypeScript - Warm Gold
      case 'jsx':
      case 'tsx':
        return '#f97316'; // React - Vibrant Orange
      case 'html':
        return '#ef4444'; // HTML - Bright Red-Orange

      // Styling Technologies (Cool Blues)
      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
      case 'styl':
        return '#3b82f6'; // CSS/Styles - Pure Blue

      // Dynamic Languages (Warm Reds to Magentas)
      case 'rb':
        return '#dc2626'; // Ruby - Deep Red
      case 'erb':
        return '#f472b6'; // ERB - Pink
      case 'php':
        return '#a855f7'; // PHP - Purple
      case 'py':
        return '#8b5cf6'; // Python - Violet

      // System Languages (Cool Blues to Teals)
      case 'go':
        return '#06b6d4'; // Go - Cyan
      case 'rs':
        return '#0891b2'; // Rust - Teal
      case 'c':
      case 'cpp':
      case 'cc':
      case 'cxx':
        return '#0f766e'; // C/C++ - Dark Teal
      case 'cs':
        return '#059669'; // C# - Emerald

      // Mobile/Modern Languages (Purple Spectrum)
      case 'swift':
        return '#7c3aed'; // Swift - Purple
      case 'kt':
        return '#8b5cf6'; // Kotlin - Violet
      case 'dart':
        return '#3b82f6'; // Dart - Blue
      case 'java':
        return '#6366f1'; // Java - Indigo

      // Data & Config (Harmonized Purples)
      case 'json':
      case 'csv':
      case 'xml':
      case 'yaml':
      case 'yml':
      case 'toml':
        return '#a855f7'; // Data files - Bright Purple

      // Tools & Scripts (Greens)
      case 'sh':
      case 'bash':
      case 'zsh':
        return '#10b981'; // Shell - Emerald
      case 'sql':
        return '#059669'; // SQL - Green

      // Content & Media (Warm Neutrals)
      case 'md':
      case 'txt':
        return '#6b7280'; // Documentation - Cool Gray
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return '#f59e0b'; // Images - Amber

      default:
        return '#9ca3af'; // Default - Neutral Gray
    }
  };

  // Complete legend data for file type colors
  const allLegendData = useMemo(
    () => [
      // Web Technologies (Warm Gradient)
      { label: 'js/ts', color: '#fbbf24', extensions: ['js', 'ts'] },
      { label: 'jsx/tsx', color: '#f97316', extensions: ['jsx', 'tsx'] },
      { label: 'html', color: '#ef4444', extensions: ['html'] },

      // Styling Technologies (Cool Blues)
      {
        label: 'css/styles',
        color: '#3b82f6',
        extensions: ['css', 'scss', 'sass', 'less', 'styl'],
      },

      // Dynamic Languages (Warm Reds to Magentas)
      { label: 'rb', color: '#dc2626', extensions: ['rb'] },
      { label: 'erb', color: '#f472b6', extensions: ['erb'] },
      { label: 'php', color: '#a855f7', extensions: ['php'] },
      { label: 'py', color: '#8b5cf6', extensions: ['py'] },

      // System Languages (Cool Blues to Teals)
      { label: 'go', color: '#06b6d4', extensions: ['go'] },
      { label: 'rs', color: '#0891b2', extensions: ['rs'] },
      {
        label: 'c/c++',
        color: '#0f766e',
        extensions: ['c', 'cpp', 'cc', 'cxx'],
      },
      { label: 'cs', color: '#059669', extensions: ['cs'] },

      // Mobile/Modern Languages (Purple Spectrum)
      { label: 'swift', color: '#7c3aed', extensions: ['swift'] },
      { label: 'kt', color: '#8b5cf6', extensions: ['kt'] },
      { label: 'dart', color: '#3b82f6', extensions: ['dart'] },
      { label: 'java', color: '#6366f1', extensions: ['java'] },

      // Data & Config (Harmonized Purples)
      {
        label: 'data',
        color: '#a855f7',
        extensions: ['json', 'csv', 'xml', 'yaml', 'yml', 'toml'],
      },

      // Tools & Scripts (Greens)
      { label: 'shell', color: '#10b981', extensions: ['sh', 'bash', 'zsh'] },
      { label: 'sql', color: '#059669', extensions: ['sql'] },

      // Content & Media (Warm Neutrals)
      { label: 'docs', color: '#6b7280', extensions: ['md', 'txt'] },
      {
        label: 'images',
        color: '#f59e0b',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
      },

      { label: 'other', color: '#9ca3af', extensions: [] },
    ],
    []
  );

  // Function to get extensions present in the current data
  const getVisibleExtensions = useCallback(dataTree => {
    if (!dataTree) return new Set();

    const extensions = new Set();

    const traverse = node => {
      if (node.children) {
        // It's a directory, traverse children
        node.children.forEach(traverse);
      } else {
        // It's a file, extract extension
        const extension = node.name.split('.').pop()?.toLowerCase();
        if (extension) {
          extensions.add(extension);
        }
      }
    };

    traverse(dataTree);
    return extensions;
  }, []);

  // Get dynamic legend based on visible file types
  const getDynamicLegend = useCallback(
    dataTree => {
      const visibleExtensions = getVisibleExtensions(dataTree);
      const dynamicLegend = [];

      // Check each legend item to see if any of its extensions are visible
      allLegendData.forEach(legendItem => {
        if (legendItem.extensions.length === 0) {
          // This is the "Other" category - include if there are extensions not covered by other categories
          const coveredExtensions = new Set();
          allLegendData.forEach(item => {
            if (item.extensions.length > 0) {
              item.extensions.forEach(ext => coveredExtensions.add(ext));
            }
          });

          const uncoveredExtensions = Array.from(visibleExtensions).filter(
            ext => !coveredExtensions.has(ext)
          );

          if (uncoveredExtensions.length > 0) {
            // Always show "other" for uncovered extensions
            dynamicLegend.push({
              ...legendItem,
              label: 'other',
            });
          }
        } else {
          // Check if any of this item's extensions are present
          const presentExtensions = legendItem.extensions.filter(ext =>
            visibleExtensions.has(ext)
          );

          if (presentExtensions.length > 0) {
            // Create dynamic label based on present extensions
            const label = presentExtensions.join(', ');
            dynamicLegend.push({
              ...legendItem,
              label: label,
            });
          }
        }
      });

      return dynamicLegend;
    },
    [allLegendData, getVisibleExtensions]
  );

  // Get the current dynamic legend
  const legendData = getDynamicLegend(data);

  const zoomed = useCallback(({ transform }, nodeGroup, hoverGroup) => {
    nodeGroup.attr('transform', transform);
    hoverGroup.attr('transform', transform); // Apply same transform to hover labels

    // Update font size of existing hover labels to compensate for zoom
    hoverGroup.selectAll('.hover-label').attr('font-size', 16 / transform.k);
  }, []);

  // Smart case matching function
  const matchesFilter = useCallback((name, filterText) => {
    if (!filterText) return true;

    // Smart case: if filter has uppercase, do case-sensitive match
    // if filter is all lowercase, do case-insensitive match
    const hasUpperCase = /[A-Z]/.test(filterText);

    if (hasUpperCase) {
      return name.includes(filterText);
    } else {
      return name.toLowerCase().includes(filterText.toLowerCase());
    }
  }, []);

  // Apply filter highlighting
  const applyFilter = useCallback(
    nodeSelection => {
      if (!filter) {
        // No filter - show all elements normally
        nodeSelection.attr('opacity', 1).attr('stroke-opacity', 1);
      } else {
        // Apply filter - dim non-matching files only, keep directories at full opacity
        nodeSelection
          .attr('opacity', d => {
            // If it's a directory (has children), always show at full opacity
            if (d.children) return 1;
            // If it's a file, check if it matches the filter
            return matchesFilter(d.data.name, filter) ? 1 : 0.2;
          })
          .attr('stroke-opacity', d => {
            // If it's a directory (has children), always show at full opacity
            if (d.children) return 1;
            // If it's a file, check if it matches the filter
            return matchesFilter(d.data.name, filter) ? 1 : 0.2;
          });
      }
    },
    [filter, matchesFilter]
  );

  // Handle clicks outside context menu to close it
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Build file path from node data
  const buildFilePath = useCallback(nodeData => {
    const pathParts = [];
    let current = nodeData;

    // Traverse up to root to build full path
    while (current) {
      pathParts.unshift(current.data.name);
      current = current.parent;
    }

    // Remove the first element (root) and join with '/'
    return pathParts.slice(1).join('/');
  }, []);

  useEffect(() => {
    if (data) {
      const width = svgRef.current.parentElement.offsetWidth;
      const height = svgRef.current.parentElement.offsetHeight;

      const pack = data =>
        d3.pack().size([width, height]).padding(3)(
          d3
            .hierarchy(data)
            .sum(d => d.size || 1)
            .sort((a, b) => b.value - a.value)
        );

      const root = pack(data);

      const svg = d3
        .select(svgRef.current)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('display', 'block')
        .style('margin', '0')
        .style('background', theme === 'dark' ? '#1a202c' : 'white')
        .style('cursor', 'pointer');

      svg.selectAll('*').remove();

      const nodeGroup = svg.append('g');
      const hoverGroup = svg.append('g'); // Separate group for hover labels

      const _node = nodeGroup
        .selectAll('circle')
        .data(root.descendants().slice(1))
        .join('circle')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', d => d.r)
        .attr('fill', d =>
          d.children ? 'transparent' : getFileColor(d.data.name)
        )
        .attr('stroke', d =>
          d.children ? (theme === 'dark' ? '#4a5568' : '#999') : null
        )
        .on('mouseover', function (event, d) {
          // Highlight the hovered circle
          d3.select(this).attr('stroke', '#000').attr('stroke-width', 2);

          // Get current zoom transform to maintain constant font size
          const currentTransform = d3.zoomTransform(svg.node());

          // Show names for the hovered item and all its parents
          const pathToRoot = [];
          let current = d;
          while (current && current !== root) {
            pathToRoot.unshift(current);
            current = current.parent;
          }

          // Show hover labels for all items in the path
          pathToRoot.forEach(nodeData => {
            // Use original coordinates, not transformed ones
            const labelY = nodeData.children
              ? nodeData.y - nodeData.r - 5 // Directory: show above circle
              : nodeData.y; // File: show centered in circle

            hoverGroup
              .append('text')
              .datum(nodeData)
              .attr('class', 'hover-label')
              .attr('x', nodeData.x)
              .attr('y', labelY)
              .attr('text-anchor', 'middle')
              .attr('font-size', 16 / currentTransform.k) // Compensate for zoom scale
              .attr('font-weight', 'bold')
              .attr('fill', theme === 'dark' ? '#ffffff' : '#000000')
              .attr('pointer-events', 'none')
              .text(
                nodeData.children
                  ? `${nodeData.data.name}/`
                  : nodeData.data.name
              );
          });
        })
        .on('mouseout', function (event, d) {
          // Reset the stroke style
          d3.select(this)
            .attr(
              'stroke',
              d.children ? (theme === 'dark' ? '#4a5568' : '#999') : null
            )
            .attr('stroke-width', null);

          // Remove all hover labels
          hoverGroup.selectAll('.hover-label').remove();
        })
        .on('click', (event, d) => {
          // Only show context menu for files (not directories)
          if (!d.children) {
            event.stopPropagation();
            const filePath = buildFilePath(d);

            setContextMenu({
              x: event.pageX,
              y: event.pageY,
              filePath: filePath,
              fileName: d.data.name,
            });
          }
        });

      // Apply initial filter
      applyFilter(_node);

      svg.call(
        d3
          .zoom()
          .extent([
            [0, 0],
            [width, height],
          ])
          .scaleExtent([0.1, 8])
          .on('zoom', event => zoomed(event, nodeGroup, hoverGroup))
      );

      // Set the initial zoom state to identity (no transform)
      // This way D3 starts from a known state
      svg.call(d3.zoom().transform, d3.zoomIdentity);
    }
  }, [data, theme, zoomed, applyFilter, buildFilePath]);

  // Apply filter when filter state changes
  useEffect(() => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const nodeSelection = svg.selectAll('circle');
      applyFilter(nodeSelection);
    }
  }, [filter, applyFilter]);

  const handleIgnoreApply = () => {
    setIgnore(pendingIgnore);
  };

  return (
    <div className="p-4 h-full flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Code Glimpse</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {showSettings && (
        <div className="mb-4 p-4 border rounded bg-gray-100 dark:bg-gray-800">
          <label className="block mb-2 font-semibold">Ignore Files</label>
          <div className="flex">
            <input
              type="text"
              placeholder="semicolon-separated..."
              className="flex-grow p-2 border rounded-l bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              value={pendingIgnore}
              onChange={e => setPendingIgnore(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleIgnoreApply()}
            />
            <button
              onClick={handleIgnoreApply}
              className="p-2 bg-blue-600 text-white rounded-r hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="flex-grow relative">
        {/* Filter widget with legend - floating in top-right corner */}
        <div className="absolute top-4 right-4 z-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 min-w-64">
          {/* Filter input */}
          <div className="flex items-center space-x-2 mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-500 dark:text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Filter by name..."
              className="flex-1 p-1 text-sm border-none outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>

          {/* Legend */}
          {legendData.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Types
              </div>
              <div className="grid grid-cols-2 gap-1">
                {legendData.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <svg ref={svgRef} className="w-full h-full"></svg>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="absolute z-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-48"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              transform: 'translate(-50%, -100%)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
              onClick={() => {
                if (onOpenInCodeCanvas) {
                  onOpenInCodeCanvas(contextMenu.filePath);
                }
                setContextMenu(null);
              }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <span>Open in Code Canvas</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeGlimpse;
