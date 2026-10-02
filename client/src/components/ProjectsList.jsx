import { useState } from 'react';
import { useApi, Spinner, Alert, StatusBadge, formatCurrency, SearchBar, Pagination, Avatar } from './shared';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProjectsList() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, loading, error } = useApi(() => 
    api.getProjects({ page, limit: 20, search, status: statusFilter }),
    [page, search, statusFilter]
  );

  const statuses = [
    'PENDING_ADMIN_APPROVAL', 'AVAILABLE_FOR_DEVELOPER', 'ASSIGNED', 
    'IN_DEVELOPMENT', 'TESTING', 'SUBMITTED', 'PENDING_FINAL_APPROVAL', 
    'REVISION_REQUIRED', 'COMPLETED', 'CLOSED'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{user.role === 'developer' ? 'Available Projects' : 'Projects'}</h1>
          <p className="page-desc">Manage project lifecycle and assignments</p>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <SearchBar 
          value={search} 
          onChange={setSearch} 
          placeholder="Search by client, project ID, or phone..."
          filters={
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          }
        />

        {loading ? <Spinner size="lg" /> : error ? <Alert type="error">{error}</Alert> : (
          <>
            <div className="table-wrapper" style={{ marginTop: '24px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Project ID</th>
                    <th>Client</th>
                    <th>Status</th>
                    {user.role !== 'developer' && <th>Salesperson</th>}
                    {user.role !== 'sales' && <th>Developer</th>}
                    {user.role === 'admin' && <th>Project Value</th>}
                    {user.role === 'developer' && <th>Payout</th>}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.projects.map(p => (
                    <tr key={p.id}>
                      <td className="td-muted">{p.project_id}</td>
                      <td>
                        <div className="font-bold">{p.client_name}</div>
                        {p.org_name && <div className="text-xs text-muted">{p.org_name}</div>}
                      </td>
                      <td><StatusBadge status={p.status} /></td>
                      {user.role !== 'developer' && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar name={p.salesperson_name} size={24} />
                            <span>{p.salesperson_name}</span>
                          </div>
                        </td>
                      )}
                      {user.role !== 'sales' && (
                        <td>
                          {p.developer_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Avatar name={p.developer_name} size={24} />
                              <span>{p.developer_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted">Unassigned</span>
                          )}
                        </td>
                      )}
                      {user.role === 'admin' && <td>{formatCurrency(p.full_project_amount)}</td>}
                      {user.role === 'developer' && <td>{formatCurrency(p.developer_payout)}</td>}
                      <td>
                        <Link to={`/${user.role}/projects/${p.id}`} className="btn btn-ghost btn-sm">View Details</Link>
                      </td>
                    </tr>
                  ))}
                  {data?.projects.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
                        No projects found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {data && <Pagination page={page} total={data.total} limit={data.limit} onChange={setPage} />}
          </>
        )}
      </div>
    </div>
  );
}
