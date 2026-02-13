import { useState, useEffect } from 'react';
import { debugLogger } from '../utils/debug-logger';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState(debugLogger.getRecentLogs(100));
  const [filter, setFilter] = useState<'all' | 'error' | 'perf'>('all');

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setLogs(debugLogger.getRecentLogs(100));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  const handleExport = () => {
    const logsJson = debugLogger.exportLogs();
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foxy-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirm('Clear all logs?')) {
      debugLogger.clearLogs();
      setLogs([]);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-full shadow-lg z-50 text-sm font-bold"
        style={{ fontFamily: 'monospace' }}
      >
        🐛 DEBUG
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-yellow-400">🐛 Debug Panel</h2>
          <span className="text-sm text-gray-400">
            {debugLogger.isDesktop() ? '🖥️ Desktop' : '📱 Mobile'}
          </span>
          <span className="text-sm text-gray-400">
            {logs.length} logs
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
          >
            <option value="all">All</option>
            <option value="error">Errors Only</option>
            <option value="perf">Performance</option>
          </select>
          
          <button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            📥 Export
          </button>
          
          <button
            onClick={handleClear}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
          >
            🗑️ Clear
          </button>
          
          <button
            onClick={() => setIsOpen(false)}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <p className="text-gray-500 text-center mt-8">No logs to display</p>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, idx) => {
              const time = new Date(log.timestamp).toLocaleTimeString();
              const levelColors = {
                info: 'text-blue-400',
                warn: 'text-yellow-400',
                error: 'text-red-400',
                perf: 'text-purple-400',
              };

              return (
                <div
                  key={idx}
                  className={`p-2 rounded ${
                    log.level === 'error' ? 'bg-red-900 bg-opacity-20' : 'bg-gray-800 bg-opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500">{time}</span>
                    <span className={`font-bold ${levelColors[log.level]}`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="text-yellow-300">[{log.category}]</span>
                    <span className="text-gray-300 flex-1">{log.message}</span>
                  </div>
                  
                  {log.data && (
                    <details className="mt-1 ml-4">
                      <summary className="text-gray-500 cursor-pointer text-xs">
                        📊 Data
                      </summary>
                      <pre className="text-gray-400 mt-1 overflow-auto max-h-40 bg-black bg-opacity-30 p-2 rounded">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
