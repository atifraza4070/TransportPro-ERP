import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrencyPKR } from '../../utils/billing-calculations';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  Truck,
  MapPin,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Building,
  DollarSign,
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/analytics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [token]);

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading fleet business intelligence...
      </div>
    );
  }

  const { metrics, customerBilling, cityTrips, vehicleTypes } = data;

  // Max value for bar scaling
  const maxCustomerBilling = Math.max(...customerBilling.map((c: any) => c.amount), 1);
  const maxCityTrips = Math.max(...cityTrips.map((c: any) => c.count), 1);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Fleet Analytics & Financial Ledger</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Real-time billing analytics derived strictly from registered transport invoices and route trips.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Freight SubTotal</p>
          <h3 className="text-base font-extrabold text-slate-900 mt-1">
            Rs. {formatCurrencyPKR(metrics.totalRevenue)}
          </h3>
          <p className="text-[10px] text-blue-600 font-medium mt-1">Excluding sales tax</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total Invoiced (Grand)</p>
          <h3 className="text-base font-extrabold text-blue-700 mt-1">
            Rs. {formatCurrencyPKR(metrics.grandBilled)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Includes 15% Punjab tax</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Halting Charges</p>
          <h3 className="text-base font-extrabold text-amber-600 mt-1">
            Rs. {formatCurrencyPKR(metrics.totalHaltingCharges)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Customer + Factory</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Movement Charges</p>
          <h3 className="text-base font-extrabold text-indigo-600 mt-1">
            Rs. {formatCurrencyPKR(metrics.totalMovementCharges)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Yard & special shiftings</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Total Trips Executed</p>
          <h3 className="text-base font-extrabold text-slate-900 mt-1">
            {metrics.totalTrips} Trips
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Across all destinations</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">Registered Invoices</p>
          <h3 className="text-base font-extrabold text-emerald-600 mt-1">
            {metrics.totalInvoices} Invoices
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">{metrics.totalVehicles} fleet vehicles</p>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Wise Billing */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">Customer-Wise Revenue Distribution</h3>
            </div>
            <span className="text-xs text-slate-500">Revenue (Rs.)</span>
          </div>

          <div className="space-y-3">
            {customerBilling.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No customer records</p>
            ) : (
              customerBilling.map((cb: any, i: number) => {
                const pct = Math.round((cb.amount / maxCustomerBilling) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800 font-semibold truncate max-w-[220px]">{cb.name}</span>
                      <span className="font-mono text-slate-900 font-bold">Rs. {formatCurrencyPKR(cb.amount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* City Wise Vehicle Movement */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">City-Wise Loading & Destination Trips</h3>
            </div>
            <span className="text-xs text-slate-500">Trip Counts</span>
          </div>

          <div className="space-y-3">
            {cityTrips.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No trip records</p>
            ) : (
              cityTrips.map((ct: any, i: number) => {
                const pct = Math.round((ct.count / maxCityTrips) * 100);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800 font-semibold uppercase">{ct.city}</span>
                      <span className="font-bold text-slate-900">{ct.count} Trips</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Vehicle Type Distribution */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Truck className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-sm">Fleet Container & Vehicle Type Utilization</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {vehicleTypes.map((vt: any, i: number) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <p className="text-xs font-semibold text-slate-600">{vt.type}</p>
              <h4 className="text-xl font-black text-indigo-600 mt-1">{vt.count}</h4>
              <p className="text-[10px] text-slate-400">Total freight dispatches</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
