import React, { useEffect, useMemo, useState } from 'react';
import { BackendConfig, HealthState, LogEntry, LogLevel, ServiceStatus } from '../types';
import { PlayIcon, StopIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';

const levelLabels: Record<LogLevel, string> = {
  info: '信息',
  warn: '警告',
  error: '错误',
  debug: '调试'
};

const levelColors: Record<LogLevel, string> = {
  info: 'text-slate-200',
  warn: 'text-amber-300',
  error: 'text-rose-300',
  debug: 'text-slate-400'
};

const healthLabels: Record<HealthState, { label: string; className: string }> = {
  healthy: { label: '健康', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  unhealthy: { label: '异常', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  unknown: { label: '未知', className: 'bg-slate-100 text-slate-500 border border-slate-200' }
};

const DEFAULT_CONFIG: BackendConfig = {
  port: 3000,
  logLevel: 'info',
  autoRestart: true
};

type PortConflictPayload = { port: number; suggestions?: number[] };

const App: React.FC = () => {
  const [config, setConfig] = useState<BackendConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [health, setHealth] = useState<HealthState>('unknown');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>(['info', 'warn', 'error', 'debug']);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portConflict, setPortConflict] = useState<PortConflictPayload | null>(null);

  useEffect(() => {
    window.backend.getConfig().then(setConfig);
    window.backend.getStatus().then(setStatus);

    const unsubLog = window.backend.onLog((entry) => {
      setLogs((prev) => [...prev.slice(-999), entry]);
    });
    const unsubStatus = window.backend.onStatus((newStatus) => {
      setStatus(newStatus);
      if (newStatus.state === 'stopped') {
        setLoading(false);
      }
    });
    const unsubError = window.backend.onError((payload) => {
      setError(`${payload.title}: ${payload.message}\n${payload.suggestion ?? ''}`);
      setLoading(false);
    });
    const unsubHealth = window.backend.onHealth((state) => setHealth(state));
    const unsubPortConflict = window.backend.onPortConflict((payload) => {
      setPortConflict(payload);
      setLoading(false);
    });

    return () => {
      unsubLog();
      unsubStatus();
      unsubError();
      unsubHealth();
      unsubPortConflict();
    };
  }, []);

  const handleStart = async () => {
    setError(null);
    setPortConflict(null);
    setLoading(true);
    try {
      const newStatus = await window.backend.startService();
      setStatus(newStatus);
    } catch (err: any) {
      setError(err.message ?? '服务启动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const newStatus = await window.backend.stopService();
      setStatus(newStatus);
    } catch (err: any) {
      setError(err.message ?? '停止失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (partial: Partial<BackendConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    await window.backend.setConfig(config);
    setError(null);
  };

  const handleRestore = async () => {
    const restored = await window.backend.restoreDefaults();
    setConfig(restored);
  };

  const handleApplySuggestion = async (port: number) => {
    const newConfig = { ...config, port };
    setConfig(newConfig);
    await window.backend.setConfig(newConfig);
    setPortConflict(null);
  };

  const filteredLogs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return logs.filter((entry) => {
      if (!selectedLevels.includes(entry.level)) return false;
      if (!normalizedKeyword) return true;
      return entry.message.toLowerCase().includes(normalizedKeyword);
    });
  }, [logs, keyword, selectedLevels]);

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(
        filteredLogs
          .map((log) => `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`)
          .join('\n')
      );
    } catch (err) {
      setError('复制失败，请确认系统权限。');
    }
  };

  const runningDuration = useMemo(() => {
    if (!status?.startedAt || status.state !== 'running') return '00:00:00';
    const diff = Date.now() - status.startedAt;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return [hours, minutes, seconds]
      .map((value) => value.toString().padStart(2, '0'))
      .join(':');
  }, [status?.startedAt, status?.state]);

  const isRunning = status?.state === 'running';
  const isStarting = status?.state === 'starting';

  return (
    <div className="min-h-screen flex flex-col gap-4 p-6 text-slate-800">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary-dark">ShiguReader 服务控制台</h1>
          <p className="text-sm text-slate-500">可视化管理后台服务，适合非技术用户快速操作。</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot state={status?.state ?? 'stopped'} />
          <HealthBadge state={health} />
        </div>
      </header>

      <main className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1">
        <section className="col-span-1 bg-white shadow rounded-lg p-4 flex flex-col gap-4">
          <h2 className="text-lg font-medium">启动配置</h2>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-slate-500">服务端口</span>
            <input
              type="number"
              className="rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={config.port}
              min={1}
              max={65535}
              onChange={(event) => handleConfigChange({ port: Number(event.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-slate-500">日志级别</span>
            <select
              className="rounded border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              value={config.logLevel}
              onChange={(event) => handleConfigChange({ logLevel: event.target.value as LogLevel })}
            >
              {(['info', 'warn', 'error', 'debug'] as LogLevel[]).map((level) => (
                <option key={level} value={level}>
                  {levelLabels[level]}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={config.autoRestart}
              onChange={(event) => handleConfigChange({ autoRestart: event.target.checked })}
            />
            崩溃自动重启（最多 3 次）
          </label>
          <div className="flex gap-2 mt-auto">
            <button
              className="px-4 py-2 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
              onClick={handleRestore}
            >
              恢复默认
            </button>
            <button
              className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-dark"
              onClick={handleSave}
            >
              保存配置
            </button>
          </div>
        </section>

        <section className="col-span-1 xl:col-span-2 bg-white shadow rounded-lg p-4 flex flex-col gap-4">
          <h2 className="text-lg font-medium">服务控制</h2>
          {error && (
            <div className="rounded border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm flex items-start gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 mt-0.5" />
              <div>
                <strong className="block">{error.split('\n')[0]}</strong>
                <p>{error.split('\n').slice(1).join('\n')}</p>
              </div>
            </div>
          )}
          {portConflict && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
              <p>端口 {portConflict.port} 已被占用。请选择以下可用端口并重试：</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {(portConflict.suggestions ?? []).map((port) => (
                  <button
                    key={port}
                    className="px-3 py-1 rounded bg-amber-100 hover:bg-amber-200"
                    onClick={() => handleApplySuggestion(port)}
                  >
                    {port}
                  </button>
                ))}
                <button
                  className="px-3 py-1 rounded border border-amber-300 hover:bg-amber-100"
                  onClick={async () => {
                    const suggestions = await window.backend.getPortSuggestions();
                    setPortConflict({ port: config.port, suggestions });
                  }}
                >
                  重新推荐
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <InfoCard label="当前状态" value={translateState(status?.state ?? 'stopped')} />
            <InfoCard label="运行时间" value={runningDuration} />
            <InfoCard label="监听端口" value={String(status?.port ?? config.port)} />
            <InfoCard label="进程 PID" value={status?.pid ? String(status.pid) : '—'} />
          </div>
          <div className="flex gap-2">
            <button
              className={classNames(
                'flex items-center gap-2 px-4 py-2 rounded text-white transition',
                (isRunning || isStarting || loading) ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'
              )}
              disabled={isRunning || isStarting || loading}
              onClick={handleStart}
            >
              <PlayIcon className="w-5 h-5" />
              启动服务
            </button>
            <button
              className={classNames(
                'flex items-center gap-2 px-4 py-2 rounded text-white transition',
                !isRunning ? 'bg-slate-400 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600'
              )}
              disabled={!isRunning}
              onClick={handleStop}
            >
              <StopIcon className="w-5 h-5" />
              停止服务
            </button>
          </div>
        </section>
      </main>

      <section className="bg-white shadow rounded-lg p-4 flex flex-col gap-4 h-[40vh]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <InformationCircleIcon className="w-5 h-5" />
            实时日志
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="按关键字过滤"
              className="rounded border border-slate-200 px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <div className="flex gap-1">
              {(Object.keys(levelLabels) as LogLevel[]).map((level) => (
                <button
                  key={level}
                  className={classNames(
                    'px-2 py-1 rounded border text-xs',
                    selectedLevels.includes(level)
                      ? 'bg-primary text-white border-primary'
                      : 'border-slate-200 text-slate-500'
                  )}
                  onClick={() =>
                    setSelectedLevels((prev) =>
                      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
                    )
                  }
                >
                  {levelLabels[level]}
                </button>
              ))}
            </div>
            <button
              className="px-3 py-1 rounded border border-slate-200 text-sm hover:bg-slate-100"
              onClick={() => setLogs([])}
            >
              清屏
            </button>
            <button
              className="px-3 py-1 rounded border border-slate-200 text-sm hover:bg-slate-100"
              onClick={handleCopyLogs}
            >
              复制全部
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-950 rounded text-sm p-3 text-slate-50">
          {filteredLogs.length === 0 && (
            <p className="text-slate-400">暂无日志输出。</p>
          )}
          {filteredLogs.map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className={classNames('whitespace-pre-wrap', levelColors[entry.level])}>
              <span className="text-xs text-slate-500 mr-2">{formatTimestamp(entry.timestamp)}</span>
              <span className="mr-2">[{entry.level.toUpperCase()}]</span>
              <span>{entry.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default App;

const StatusDot: React.FC<{ state: ServiceStatus['state'] }> = ({ state }) => {
  const mapping: Record<ServiceStatus['state'], string> = {
    running: 'bg-emerald-500',
    starting: 'bg-amber-500 animate-pulse',
    stopping: 'bg-amber-400 animate-pulse',
    stopped: 'bg-slate-400'
  };
  return <span className={classNames('w-3 h-3 rounded-full inline-block', mapping[state])} title={translateState(state)} />;
};

const HealthBadge: React.FC<{ state: HealthState }> = ({ state }) => {
  const meta = healthLabels[state];
  return <span className={classNames('px-3 py-1 rounded-full text-xs font-medium', meta.className)}>{meta.label}</span>;
};

const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex flex-col gap-1">
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    <span className="text-lg font-semibold text-slate-800">{value}</span>
  </div>
);

function translateState(state: ServiceStatus['state']): string {
  switch (state) {
    case 'running':
      return '运行中';
    case 'starting':
      return '启动中';
    case 'stopping':
      return '停止中';
    default:
      return '已停止';
  }
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString();
}
