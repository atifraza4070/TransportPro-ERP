import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Customer } from '../../types';
import { Users, Plus, Building, Trash2, Edit2, Phone, Mail, MapPin, Hash } from 'lucide-react';

export const CustomerManager: React.FC = () => {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    id: '',
    name: '',
    address: '',
    ntn: '',
    strn: '',
    phone: '',
    email: '',
  });

  const fetchCustomers = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/customers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ id: '', name: '', address: '', ntn: '', strn: '', phone: '', email: '' });
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"?`)) return;
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCustomers(customers.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer Directory & Tax IDs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage client businesses, addresses, NTN numbers, and STRN credentials for instant invoice generation.
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ id: '', name: '', address: '', ntn: '', strn: '', phone: '', email: '' });
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c) => (
          <div key={c.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm truncate max-w-[200px]">{c.name}</h3>
                  <p className="text-[11px] text-slate-400">Added on {c.createdAt?.split('T')[0] || '2026'}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(c.id, c.name)}
                className="text-slate-400 hover:text-rose-600 p-1"
                title="Delete Customer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{c.address || 'Address not registered'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">NTN NUMBER</span>
                  <span className="font-mono font-semibold text-slate-800">{c.ntn || 'Not Set'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">STRN NUMBER</span>
                  <span className="font-mono font-semibold text-slate-800">{c.strn || 'Not Set'}</span>
                </div>
              </div>
              {(c.phone || c.email) && (
                <div className="flex items-center gap-3 pt-1 text-slate-500">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Customer Company</h3>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Company / Customer Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. M/S BULLEH SHAH PACKAGING (PVT) LTD"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg uppercase"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Business Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Shahrah-e-Roomi, P.O Amer Sidhu Lahore"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">NTN Number</label>
                  <input
                    type="text"
                    value={form.ntn}
                    onChange={(e) => setForm({ ...form, ntn: e.target.value })}
                    placeholder="3000673-2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">STRN Number</label>
                  <input
                    type="text"
                    value={form.strn}
                    onChange={(e) => setForm({ ...form, strn: e.target.value })}
                    placeholder="1700300067314"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="042-35800000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="billing@customer.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
