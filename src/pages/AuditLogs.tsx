import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AuditLogItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import { ShieldAlert, RefreshCw, Search, CheckCircle2 } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs(100);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (filterAction === 'ALL') return true;
    return l.action.includes(filterAction);
  });

  return (
    <div className="space-y-6">
      <MedicalDisclaimer />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Security & Operational Audit Trail</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all federated learning rounds, model aggregations, dataset uploads, and inference events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-medium focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Event Types</option>
            <option value="FEDERATED">Federated Rounds</option>
            <option value="TRAINING">Local Training</option>
            <option value="DATASET">Dataset Ingestion</option>
            <option value="PREDICTION">Inference Requests</option>
            <option value="USER">Authentication & User</option>
          </select>
          <button
            onClick={fetchLogs}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Actor / User</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-teal-800">
                      {l.action}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {l.user_name || 'System Auto'}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {l.resource}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400 max-w-xs truncate">
                      {l.metadata_json ? JSON.stringify(l.metadata_json) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No audit log records found matching selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
