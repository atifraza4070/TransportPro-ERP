import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Vehicle, TransporterVehicleType } from '../../types';
import { Truck, Plus, Trash2, User, Phone, CheckCircle2, Layers, Edit2, X, AlertCircle } from 'lucide-react';

export const VehicleManager: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'vehicles' | 'types'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<TransporterVehicleType[]>([]);
  const [loading, setLoading] = useState(true);

  // Vehicle Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    id: '',
    vehicleNo: '',
    vehicleType: '20 Ft Vehicle',
    driverName: '',
    driverPhone: '',
    status: 'available',
  });

  // Type Modal
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<TransporterVehicleType | null>(null);
  const [typeName, setTypeName] = useState('');

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [vehRes, typeRes] = await Promise.all([
        fetch('/api/vehicles', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/vehicle-types', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (vehRes.ok) {
        const data = await vehRes.json();
        setVehicles(data.vehicles || []);
      }
      if (typeRes.ok) {
        const tData = await typeRes.json();
        setVehicleTypes(tData.vehicleTypes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // ---------------- VEHICLE HANDLERS ----------------
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleNo) return;
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({
          id: '',
          vehicleNo: '',
          vehicleType: vehicleTypes.length > 0 ? vehicleTypes[0].name : '20 Ft Vehicle',
          driverName: '',
          driverPhone: '',
          status: 'available',
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm('Delete this vehicle from fleet?')) return;
    try {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setVehicles(vehicles.filter((v) => v.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------- VEHICLE TYPE HANDLERS ----------------
  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = typeName.trim();
    if (!clean) return;

    try {
      if (editingType) {
        // Edit
        const res = await fetch(`/api/vehicle-types/${editingType.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: clean }),
        });
        if (res.ok) {
          setShowTypeModal(false);
          setEditingType(null);
          setTypeName('');
          fetchData();
        }
      } else {
        // Create
        const res = await fetch('/api/vehicle-types', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: clean }),
        });
        if (res.ok) {
          setShowTypeModal(false);
          setTypeName('');
          fetchData();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTypeStatus = async (vt: TransporterVehicleType) => {
    const newStatus = vt.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/vehicle-types/${vt.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteType = async (vt: TransporterVehicleType) => {
    if (!confirm(`Delete vehicle type "${vt.name}"? Note: Existing historical invoices will preserve their saved vehicle type values.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/vehicle-types/${vt.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setVehicleTypes((prev) => prev.filter((t) => t.id !== vt.id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fleet & Vehicle Categories</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your transport trucks and dynamic vehicle types. Newly added types are automatically available for future invoices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'vehicles' ? (
            <button
              onClick={() => {
                setForm({
                  id: '',
                  vehicleNo: '',
                  vehicleType: vehicleTypes.find((t) => t.status !== 'inactive')?.name || '20 Ft Vehicle',
                  driverName: '',
                  driverPhone: '',
                  status: 'available',
                });
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Fleet Vehicle
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingType(null);
                setTypeName('');
                setShowTypeModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add New Vehicle Type
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'vehicles'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Fleet Vehicles ({vehicles.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'types'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Dynamic Vehicle Types ({vehicleTypes.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: FLEET VEHICLES */}
      {activeTab === 'vehicles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {vehicles.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
              <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 text-sm">No vehicles registered yet</p>
              <p className="text-xs text-slate-400 mt-1">Click "Add Fleet Vehicle" to add trucks to your transport pool.</p>
            </div>
          ) : (
            vehicles.map((v) => (
              <div key={v.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-mono font-black text-slate-900 text-sm tracking-wide">{v.vehicleNo}</h3>
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {v.vehicleType}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteVehicle(v.id)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                    title="Delete Vehicle"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-2 text-xs space-y-1 text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{v.driverName || 'Driver not assigned'}</span>
                  </div>
                  {v.driverPhone && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{v.driverPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: DYNAMIC VEHICLE TYPES */}
      {activeTab === 'types' && (
        <div className="space-y-4">
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
            <Layers className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-950">Dynamic Transporter Vehicle Types</p>
              <p className="mt-0.5 text-blue-800">
                You can add custom vehicle categories (e.g. 50 Ft Trailer, 14 Ft Shehzore, Mazda, Flatbed). These types are automatically available in Create Invoice. Renaming or deactivating a category preserves historical invoices.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <th className="py-3 px-4">VEHICLE TYPE / CATEGORY</th>
                  <th className="py-3 px-3">STATUS</th>
                  <th className="py-3 px-3">REGISTERED AT</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicleTypes.map((vt) => (
                  <tr key={vt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {vt.name}
                    </td>
                    <td className="py-3 px-3">
                      {vt.status === 'active' ? (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          Active (Visible in Invoices)
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Deactivated (Archived)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {vt.createdAt ? new Date(vt.createdAt).toLocaleDateString() : 'System default'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleTypeStatus(vt)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold transition-colors ${
                            vt.status === 'active'
                              ? 'text-amber-700 hover:bg-amber-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {vt.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingType(vt);
                            setTypeName(vt.name);
                            setShowTypeModal(true);
                          }}
                          className="text-slate-400 hover:text-blue-600 p-1"
                          title="Rename type"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteType(vt)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Delete type"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD VEHICLE */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Transport Vehicle</h3>
            <form onSubmit={handleSaveVehicle} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Vehicle Registration No.</label>
                <input
                  type="text"
                  value={form.vehicleNo}
                  onChange={(e) => setForm({ ...form, vehicleNo: e.target.value.toUpperCase() })}
                  placeholder="e.g. LZR 1089"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold uppercase"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Vehicle Type / Size</label>
                <select
                  value={form.vehicleType}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  {vehicleTypes
                    .filter((vt) => vt.status !== 'inactive')
                    .map((vt) => (
                      <option key={vt.id} value={vt.name}>{vt.name}</option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={form.driverName}
                    onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                    placeholder="Muhammad Akram"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Driver Phone</label>
                  <input
                    type="text"
                    value={form.driverPhone}
                    onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
                    placeholder="0300 1234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT VEHICLE TYPE */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-bold text-slate-900">
                {editingType ? 'Rename Vehicle Type' : 'Add New Vehicle Type'}
              </h3>
              <button
                type="button"
                onClick={() => setShowTypeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveType} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Category / Type Name</label>
                <input
                  type="text"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  placeholder="e.g. 50 Ft Trailer or Mazda 16 Ft"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Will be available for all future invoices created by your account.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  {editingType ? 'Update Name' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
