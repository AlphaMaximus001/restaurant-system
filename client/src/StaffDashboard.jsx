import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './StaffDashboard.css';
import { API_URL } from './config';

export default function StaffDashboard() {
  const [activeOrders, setActiveOrders] = useState({});
  const [flashingTables, setFlashingTables] = useState({});
  const [toasts, setToasts] = useState([]);
  
  // Real-time Status Bar States
  const [lastAction, setLastAction] = useState('System initialized.');
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString());

  const fetchActiveOrders = () => {
    fetch(`${API_URL}/active-orders`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch active orders');
        return res.json();
      })
      .then(data => {
        setActiveOrders(data);
      })
      .catch(err => {
        console.error('Error fetching active orders:', err);
      });
  };

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Real-time ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchActiveOrders();

    const socket = io(API_URL, {
      query: { role: 'staff' }
    });

    socket.on('connect', () => {
      console.log('[Socket] Staff dashboard connected to server');
      setLastAction('Connected to kitchen socket server.');
      addToast('Connected to kitchen server', 'info');
    });

    socket.on('new_order', (order) => {
      console.log('[Socket] Received new order:', order);
      
      // Update state
      setActiveOrders(prev => ({
        ...prev,
        [order.tableNumber]: {
          ...order,
          status: order.status || 'ordered'
        }
      }));

      setLastAction(`New order received for Table ${order.tableNumber}.`);
      addToast(`New order from Table ${order.tableNumber}! 🍳`, 'new-order');
    });

    socket.on('order_status_updated', ({ tableNumber, status }) => {
      console.log(`[Socket] Order status updated: Table ${tableNumber} -> ${status}`);
      setActiveOrders(prev => {
        if (!prev[tableNumber]) return prev;
        return {
          ...prev,
          [tableNumber]: {
            ...prev[tableNumber],
            status
          }
        };
      });
      const statusLabel = status.toUpperCase();
      setLastAction(`Table ${tableNumber} marked as ${statusLabel} via socket.`);
    });

    socket.on('payment_confirmed', ({ tableNumber }) => {
      console.log(`[Socket] Received payment confirmation for Table ${tableNumber}`);
      
      setLastAction(`Table ${tableNumber} completed checkout payment.`);
      addToast(`Table ${tableNumber} — Paid ✅`, 'paid');

      // Trigger flashing indicator
      setFlashingTables(prev => ({ ...prev, [tableNumber]: true }));

      // Wait 1.5 seconds, then delete order and remove flashing indicator
      setTimeout(() => {
        setActiveOrders(prev => {
          const updated = { ...prev };
          delete updated[tableNumber];
          return updated;
        });
        setFlashingTables(prev => {
          const updated = { ...prev };
          delete updated[tableNumber];
          return updated;
        });
      }, 1500);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Card status transition handlers
  const updateOrderStatus = (tableNumber, newStatus) => {
    fetch(`${API_URL}/order/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber, status: newStatus })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update status');
        return res.json();
      })
      .then(() => {
        const statusLabel = newStatus.toUpperCase();
        setLastAction(`Table ${tableNumber} marked as ${statusLabel}.`);
        addToast(`Table ${tableNumber} marked as ${newStatus}`, 'info');
        
        // Update local state immediately for fast responsive feedback
        setActiveOrders(prev => {
          if (!prev[tableNumber]) return prev;
          return {
            ...prev,
            [tableNumber]: {
              ...prev[tableNumber],
              status: newStatus
            }
          };
        });
      })
      .catch(err => {
        console.error('Error updating order status:', err);
        addToast(`Failed to update status for Table ${tableNumber}`, 'error');
      });
  };

  // "End Table & Bill" -> POST /end-table
  const handleEndTable = (tableNumber) => {
    fetch(`${API_URL}/end-table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to issue bill');
        return res.json();
      })
      .then(() => {
        setLastAction(`Bill sent for Table ${tableNumber}.`);
        addToast(`Bill sent to Table ${tableNumber} 🧾`, 'info');
        // Update local state immediately
        setActiveOrders(prev => {
          if (!prev[tableNumber]) return prev;
          return {
            ...prev,
            [tableNumber]: {
              ...prev[tableNumber],
              status: 'billed'
            }
          };
        });
      })
      .catch(err => {
        console.error('Bill error:', err);
        setLastAction(`Error sending bill to Table ${tableNumber}.`);
        addToast(`Could not send bill to Table ${tableNumber}`, 'error');
      });
  };

  const ordersList = Object.values(activeOrders);
  const activeCount = ordersList.length;

  return (
    <div className="staff-dashboard-container">
      {/* Floating System Balloon Alerts / Toasts */}
      <div className="toasts-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-message ${t.type}`}>
            <span className="toast-icon">
              {t.type === 'paid' ? '✅' : t.type === 'new-order' ? '🛎️' : 'ℹ️'}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Main Dashboard Space */}
      <div className="dashboard-content-area">
        <header className="dashboard-header">
          <div className="dashboard-title-area">
            <h1>RestauPOS Kitchen Dashboard</h1>
            <p className="dashboard-subtitle">Kitchen & Waitstaff Control Panel</p>
          </div>
          <div className="metrics-badge">
            <span>Active POS Tables:</span>
            <div className="metrics-count">{activeCount}</div>
          </div>
        </header>

        {/* Tabular Kitchen Dashboard Layout */}
        <div className="pos-dark-frame table-container-frame">
          {activeCount === 0 ? (
            <div className="empty-dashboard-state">
              <p className="empty-state-emoji">🍴</p>
              <h2>No pending orders right now.</h2>
              <p style={{ color: '#64748B', fontSize: '14px', marginTop: '6px' }}>Ready to receive client orders via WebSockets.</p>
            </div>
          ) : (
            <table className="kitchen-orders-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Order ID</th>
                  <th style={{ width: '100px' }}>Table</th>
                  <th>Items</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '180px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {ordersList.map(order => {
                  const tableNum = order.tableNumber;
                  const isFlashing = !!flashingTables[tableNum];
                  const timestampCode = new Date(order.createdAt).getTime().toString().slice(-4);
                  const orderId = `#ORD-${tableNum}-${timestampCode}`;

                  return (
                    <tr 
                      key={tableNum} 
                      className={`${isFlashing ? 'paid-flash-row' : ''}`}
                    >
                      <td className="order-id-cell">{orderId}</td>
                      <td className="table-number-cell">Table {tableNum}</td>
                      <td className="items-list-cell">
                        <div className="items-wrapper">
                          {order.items.map((item, idx) => (
                            <div className="kitchen-order-item" key={`${item.id}-${idx}`}>
                              <span className="item-name"><strong>{item.name}</strong></span>
                              <span className="item-qty-pill">x{item.qty}</span>
                              {item.customization && (
                                <span className="item-customization-note">
                                  ({item.customization})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-badge-kitchen ${order.status}`}>
                          {order.status === 'ordered' && 'PENDING'}
                          {order.status === 'preparing' && 'PREPARING'}
                          {order.status === 'ready' && 'READY'}
                          {order.status === 'served' && 'SERVED'}
                          {order.status === 'billed' && 'BILLED'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons-wrapper">
                          {order.status === 'ordered' && (
                            <button 
                              className="btn-ghost-pill action-prepare"
                              onClick={() => updateOrderStatus(tableNum, 'preparing')}
                            >
                              Mark Preparing
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <button 
                              className="btn-ghost-pill action-ready"
                              onClick={() => updateOrderStatus(tableNum, 'ready')}
                            >
                              Mark Ready
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <button 
                              className="btn-ghost-pill action-serve"
                              onClick={() => updateOrderStatus(tableNum, 'served')}
                            >
                              Mark Served
                            </button>
                          )}
                          {order.status === 'served' && (
                            <button 
                              className="btn-ghost-pill action-bill"
                              onClick={() => handleEndTable(tableNum)}
                            >
                              End Table & Bill
                            </button>
                          )}
                          {order.status === 'billed' && (
                            <span className="awaiting-payment-text">
                              Awaiting Payment...
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modern Status Bar at bottom */}
      <footer className="kitchen-status-bar">
        <div className="status-panel">
          <span>Active Tables: <strong>{activeCount}</strong></span>
        </div>
        <div className="status-panel status-action-log">
          <span>Log: {lastAction}</span>
        </div>
        <div className="status-panel clock-panel">
          <span>{currentTime}</span>
        </div>
      </footer>
    </div>
  );
}
