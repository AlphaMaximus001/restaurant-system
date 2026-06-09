import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import './CustomerScreen.css';
import { API_URL } from './config';

export default function CustomerScreen() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 1. Read table number from react-router-dom search params
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table') || '1';

  const [activeTab, setActiveTab] = useState('Starters');
  
  // Cart state: keyed by a compound key: `${itemId}::${customizationString}`.
  // Each item in cart: { cartKey, id, name, price, qty, customization }
  const [cart, setCart] = useState({});
  
  // View states: 'menu' | 'ordered' | 'bill' | 'paid'
  const [view, setView] = useState('menu');
  const [bill, setBill] = useState(null);
  const [socket, setSocket] = useState(null);
  const [orderStatus, setOrderStatus] = useState('ordered');

  // Customization Modal State
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [selectedCustomizeItem, setSelectedCustomizeItem] = useState(null);
  const [spiceLevel, setSpiceLevel] = useState('Medium'); // Mild, Medium, Hot
  const [selectedAddons, setSelectedAddons] = useState([]); 
  const [specialInstructions, setSpecialInstructions] = useState('');

  // 2. Fetch Menu
  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/menu`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch menu');
        return res.json();
      })
      .then(data => {
        setMenu(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Menu load error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 3. Query active order state on mount to handle refreshes
  useEffect(() => {
    if (!tableNumber) return;

    fetch(`${API_URL}/active-order/${tableNumber}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch active order');
        return res.json();
      })
      .then(data => {
        if (data.active && data.order) {
          setOrderStatus(data.order.status);
          if (data.order.status === 'billed' || data.order.status === 'bill_requested') {
            setBill(data.bill);
            setView('bill');
          } else {
            setView('ordered');
          }
        } else {
          setView('menu');
        }
      })
      .catch(err => {
        console.error('Error checking active order status:', err);
      });
  }, [tableNumber]);

  const getStepStatus = (stepName) => {
    const statusLevels = {
      'ordered': 1,
      'preparing': 2,
      'ready': 3,
      'served': 4,
      'billed': 5,
      'bill_requested': 5
    };

    const currentLevel = statusLevels[orderStatus] || 1;

    const steps = {
      'placed': 1,
      'accepted': 2,
      'preparing': 3,
      'ready': 4,
      'served': 5
    };

    const stepLevel = steps[stepName];

    if (currentLevel > stepLevel) {
      return { className: 'completed', node: '✓' };
    } else if (currentLevel === stepLevel) {
      return { className: 'active', node: '●' };
    } else {
      return { className: '', node: '' };
    }
  };

  // 7. Socket.IO connection
  useEffect(() => {
    const newSocket = io(API_URL, {
      query: { table: tableNumber }
    });

    newSocket.on('connect', () => {
      console.log(`[Socket] Table ${tableNumber} connected to server`);
    });

    // 8. On "bill_ready" event: switch to Bill View
    newSocket.on('bill_ready', (billPayload) => {
      console.log('[Socket] Received bill payload:', billPayload);
      setBill(billPayload);
      setView('bill');
    });

    // 9. On "order_status_updated" event: update order status
    newSocket.on('order_status_updated', ({ status }) => {
      console.log('[Socket] Received status update:', status);
      setOrderStatus(status);
      if (status === 'ordered') {
        setView('ordered');
      }
    });

    // 10. On "payment_confirmed" event: transition to paid screen
    newSocket.on('payment_confirmed', () => {
      console.log('[Socket] Payment confirmed by server');
      setView('paid');
      setBill(null);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [tableNumber]);

  // Open modal for customizing item
  const handleOpenCustomizeModal = (item) => {
    setSelectedCustomizeItem(item);
    setSpiceLevel('Medium');
    setSelectedAddons([]);
    setSpecialInstructions('');
    setIsCustomizeModalOpen(true);
  };

  // Toggle selected add-ons
  const handleToggleAddon = (addon) => {
    setSelectedAddons(prev => 
      prev.includes(addon) ? prev.filter(a => a !== addon) : [...prev, addon]
    );
  };

  // Get single item price including add-ons inside modal
  const getModalItemPrice = () => {
    if (!selectedCustomizeItem) return 0;
    let basePrice = selectedCustomizeItem.price;
    selectedAddons.forEach(addon => {
      if (addon.includes('+₹')) {
        const extra = parseInt(addon.split('+₹')[1], 10);
        if (!isNaN(extra)) basePrice += extra;
      }
    });
    return basePrice;
  };

  // Add customized item to cart
  const handleAddToCart = (e) => {
    e.preventDefault();
    if (!selectedCustomizeItem) return;

    const finalUnitPrice = getModalItemPrice();
    const parts = [];
    if (selectedCustomizeItem.category !== 'Drinks') {
      parts.push(`${spiceLevel} Spice`);
    }
    if (selectedAddons.length > 0) {
      const addonNames = selectedAddons.map(a => a.split(' (+₹')[0]);
      parts.push(`Add-ons: ${addonNames.join(', ')}`);
    }
    if (specialInstructions.trim()) {
      parts.push(`Note: ${specialInstructions.trim()}`);
    }
    const customizationString = parts.join(' | ');
    const cartKey = `${selectedCustomizeItem.id}::${customizationString}`;

    setCart(prev => {
      const existing = prev[cartKey];
      if (existing) {
        return {
          ...prev,
          [cartKey]: {
            ...existing,
            qty: existing.qty + 1
          }
        };
      } else {
        return {
          ...prev,
          [cartKey]: {
            cartKey,
            id: selectedCustomizeItem.id,
            name: selectedCustomizeItem.name,
            price: finalUnitPrice,
            qty: 1,
            customization: customizationString
          }
        };
      }
    });

    setIsCustomizeModalOpen(false);
    setSelectedCustomizeItem(null);
  };

  // Adjust quantity of item in the cart directly from sidebar
  const handleQtyChangeByKey = (cartKey, delta) => {
    setCart(prevCart => {
      const currentItem = prevCart[cartKey];
      if (!currentItem) return prevCart;

      const newQty = Math.max(0, currentItem.qty + delta);
      const updatedCart = { ...prevCart };
      if (newQty === 0) {
        delete updatedCart[cartKey];
      } else {
        updatedCart[cartKey] = {
          ...currentItem,
          qty: newQty
        };
      }
      return updatedCart;
    });
  };

  // Calculate subtotal
  const cartItems = Object.values(cart);
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalCartQty = cartItems.reduce((sum, item) => sum + item.qty, 0);

  // On "Place Order": POST /order
  const handlePlaceOrder = () => {
    if (cartItems.length === 0) return;

    fetch(`${API_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: tableNumber,
        items: cartItems
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Order submission failed');
        return res.json();
      })
      .then(data => {
        console.log('Order confirmed:', data);
        setView('ordered');
        setCart({}); // Clear local cart
      })
      .catch(err => {
        console.error('Order error:', err);
        alert('Could not place order. Please try again.');
      });
  };

  // On "Pay Now": POST /payment-done
  const handlePayNow = () => {
    fetch(`${API_URL}/payment-done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber: tableNumber })
    })
      .then(res => {
        if (!res.ok) throw new Error('Payment notification failed');
        return res.json();
      })
      .then(() => {
        setView('paid');
        setBill(null);
      })
      .catch(err => {
        console.error('Payment error:', err);
        alert('Payment processing failed. Please call staff.');
      });
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="pos-dialog-overlay">
        <div className="pos-dark-frame dialog-box">
          <div className="dialog-body" style={{ textAlign: 'center', padding: '32px' }}>
            <div className="spinner-loader"></div>
            <h3 style={{ marginTop: '16px' }}>Loading Menu</h3>
            <p style={{ color: '#64748B', fontSize: '14px' }}>Retrieving fresh options from the kitchen...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error Screen
  if (error) {
    return (
      <div className="pos-dialog-overlay">
        <div className="pos-dark-frame dialog-box" style={{ maxWidth: '400px' }}>
          <div className="dialog-body" style={{ padding: '24px' }}>
            <h3 style={{ color: '#E74C3C', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ System Error
            </h3>
            <p style={{ fontSize: '14px', margin: '12px 0 20px 0' }}>
              Failed to connect to menu database: {error}. Please verify the server is running on port 4000.
            </p>
            <button className="btn-primary" onClick={() => window.location.reload()} style={{ width: '100%' }}>
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Order Placed Timeline View
  if (view === 'ordered') {
    return (
      <div className="tracking-wrapper animate-fade-in">
        <div className="pos-dark-frame tracking-card">
          <h2 className="tracking-title">Order Status Table {tableNumber}</h2>
          
          {/* Vertical Timeline */}
          <div className="timeline-container">
            <div className="timeline-line"></div>
            
            <div className={`timeline-step ${getStepStatus('placed').className}`}>
              <div className={`timeline-node ${getStepStatus('placed').className === 'active' ? 'pulse' : ''}`}>
                {getStepStatus('placed').node}
              </div>
              <div className="timeline-info">
                <h4>Order Placed</h4>
                <p>Sent directly to kitchen</p>
              </div>
            </div>
            
            <div className={`timeline-step ${getStepStatus('accepted').className}`}>
              <div className={`timeline-node ${getStepStatus('accepted').className === 'active' ? 'pulse' : ''}`}>
                {getStepStatus('accepted').node}
              </div>
              <div className="timeline-info">
                <h4>Accepted</h4>
                <p>Kitchen staff confirmed</p>
              </div>
            </div>
            
            <div className={`timeline-step ${getStepStatus('preparing').className}`}>
              <div className={`timeline-node ${getStepStatus('preparing').className === 'active' ? 'pulse' : ''}`}>
                {getStepStatus('preparing').node}
              </div>
              <div className="timeline-info">
                <h4>Preparing</h4>
                <p>Chef is preparing your meal</p>
              </div>
            </div>
            
            <div className={`timeline-step ${getStepStatus('ready').className}`}>
              <div className={`timeline-node ${getStepStatus('ready').className === 'active' ? 'pulse' : ''}`}>
                {getStepStatus('ready').node}
              </div>
              <div className="timeline-info">
                <h4>Ready</h4>
                <p>Fresh & hot at counter</p>
              </div>
            </div>
            
            <div className={`timeline-step ${getStepStatus('served').className}`}>
              <div className={`timeline-node ${getStepStatus('served').className === 'active' ? 'pulse' : ''}`}>
                {getStepStatus('served').node}
              </div>
              <div className="timeline-info">
                <h4>Served</h4>
                <p>Delivered to table</p>
              </div>
            </div>
          </div>

          {/* Light-blue metadata panel below */}
          <div className="metadata-panel">
            <p className="metadata-status">🍳 Kitchen status: <strong>{orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)}</strong></p>
            <p className="metadata-hint">
              {orderStatus === 'ordered' && 'Order sent to the kitchen. Waiting for preparation to begin.'}
              {orderStatus === 'preparing' && 'Est. Preparation Time: ~15-20 mins'}
              {orderStatus === 'ready' && 'Your order is ready! It will be served shortly.'}
              {orderStatus === 'served' && 'Enjoy your meal! Let us know if you need anything else.'}
            </p>
            <p className="metadata-note">If you need extra cutlery or water, feel free to notify any staff member.</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button className="btn-secondary" onClick={() => setView('menu')} style={{ flex: 1, padding: '12px', fontWeight: 'bold' }}>
              🍽️ Order More Food / View Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Payment Completed Screen
  if (view === 'paid') {
    return (
      <div className="pos-dialog-overlay animate-fade-in">
        <div className="pos-dark-frame dialog-box" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div className="dialog-body" style={{ padding: '32px' }}>
            <div className="success-checkmark-circle">✓</div>
            <h3 style={{ fontSize: '20px', margin: '16px 0 8px 0' }}>Payment Complete</h3>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px' }}>
              Thank you for dining with us! Have a wonderful day ahead. 🙏
            </p>
            <button className="btn-primary" onClick={() => setView('menu')} style={{ width: '100%' }}>
              Order More
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Checkout Receipt View
  if (view === 'bill' && bill) {
    const totalTaxAndService = bill.tax + bill.serviceCharge;
    return (
      <div className="receipt-wrapper animate-fade-in">
        <div className="receipt-card-modern">
          <div className="receipt-header-modern">
            <span className="receipt-icon">🍽️</span>
            <h3>GOURMET BISTRO</h3>
            <p className="receipt-sub">Digital Invoice Receipt</p>
            <div className="receipt-meta">
              <span>Table: {bill.tableNumber}</span>
              <span>•</span>
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="receipt-items-container">
            {bill.items.map((item, idx) => (
              <div className="receipt-item-row-modern" key={`${item.id}-${idx}`}>
                <div className="item-name-qty">
                  <span className="item-name">{item.name}</span>
                  <span className="item-qty">x{item.qty}</span>
                </div>
                <span className="item-price">₹{(item.price * item.qty).toFixed(0)}</span>
                {item.customization && (
                  <div className="item-customization-text">
                    * {item.customization}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="receipt-totals-modern">
            <div className="receipt-row-total">
              <span>Subtotal:</span>
              <span>₹{bill.subtotal.toFixed(2)}</span>
            </div>
            <div className="receipt-row-total">
              <span>GST (18% included):</span>
              <span>₹{totalTaxAndService.toFixed(2)}</span>
            </div>
            <div className="receipt-row-total grand-total-modern">
              <span>Grand Total:</span>
              <span>₹{bill.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Stacked Payment CTAs */}
          <div className="payment-stacked-actions">
            <button className="btn-primary payment-btn" onClick={handlePayNow}>
              Pay via UPI / Card (Online)
            </button>
            <button className="btn-secondary payment-btn" onClick={handlePayNow}>
              Pay Cash to Waiter
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter menu items by active category tab
  const filteredMenu = menu.filter(item => item.category === activeTab);

  return (
    <div className="customer-screen-container">
      {/* Main Menu Panel */}
      <div className="main-menu-content">
        <header className="menu-header">
          <h1 className="restaurant-title">RestauPOS v2.1</h1>
          <span className="table-badge">Table {tableNumber} Session</span>
        </header>

        {/* Tab Switcher */}
        <div className="tab-switcher">
          {['Starters', 'Mains', 'Drinks'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Menu Cards Grid */}
        <div className="menu-cards-grid">
          {filteredMenu.map((item, index) => {
            const isAvailable = item.available !== false;
            return (
              <div 
                key={item.id} 
                className={`menu-item-card animate-staggered ${!isAvailable ? 'out-of-stock-card' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="card-top">
                  <span className="item-emoji">{item.emoji}</span>
                  <div className="item-details">
                    <h3 className="item-name">{item.name}</h3>
                    <p className="item-description">{item.description || 'Tasty authentic dish.'}</p>
                  </div>
                </div>
                <div className="card-bottom">
                  <span className="item-price">₹{item.price}</span>
                  {isAvailable ? (
                    <button 
                      className="add-to-cart-trigger" 
                      onClick={() => handleOpenCustomizeModal(item)}
                    >
                      + Add
                    </button>
                  ) : (
                    <span className="out-of-stock-label">Out of Stock</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modern Sidebar (Order Summary) */}
      <aside className="order-sidebar">
        <div className="sidebar-header">
          <h2>Order Summary</h2>
          <span className="table-label-small">Table {tableNumber}</span>
        </div>

        {['ordered', 'preparing', 'ready', 'served'].includes(orderStatus) && view === 'menu' && (
          <button 
            className="btn-primary" 
            onClick={() => setView('ordered')}
            style={{ 
              backgroundColor: '#10B981', 
              color: 'white', 
              padding: '12px', 
              margin: '12px 16px 0 16px', 
              borderRadius: '8px', 
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🕒 Track Active Order ({orderStatus})
          </button>
        )}

        <div className="cart-items-container">
          {cartItems.length === 0 ? (
            <div className="empty-cart-state">
              <div className="empty-cart-icon">🛒</div>
              <p>Your cart is empty</p>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>
                Select items from the menu to customize and add them here.
              </p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div className="cart-item-modern" key={item.cartKey}>
                <div className="cart-item-info">
                  <div className="cart-item-header-row">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-total-price">₹{(item.price * item.qty).toFixed(0)}</span>
                  </div>
                  {item.customization && (
                    <div className="cart-item-customization-detail">
                      {item.customization}
                    </div>
                  )}
                  <div className="cart-item-footer-row">
                    <span className="cart-item-unit-price">₹{item.price} each</span>
                    <div className="cart-item-qty-actions">
                      <button 
                        className="qty-btn-mini" 
                        onClick={() => handleQtyChangeByKey(item.cartKey, -1)}
                      >
                        -
                      </button>
                      <span className="qty-display-mini">{item.qty}</span>
                      <button 
                        className="qty-btn-mini" 
                        onClick={() => handleQtyChangeByKey(item.cartKey, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Summary Footer */}
        <div className="cart-summary">
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Total:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>

          <button
            className="btn-primary checkout-btn"
            disabled={cartItems.length === 0}
            onClick={handlePlaceOrder}
          >
            Place Order 🍽
          </button>
        </div>
      </aside>

      {/* Floating Bottom Cart Summary Bar (Sticky on viewport) */}
      {totalCartQty > 0 && (
        <div className="floating-cart-bar">
          <div className="floating-cart-content">
            <div className="floating-cart-stats">
              <span className="qty-count-bubble">{totalCartQty}</span>
              <span className="floating-cart-total-text">₹{subtotal.toFixed(0)}</span>
            </div>
            <button className="floating-cart-cta" onClick={handlePlaceOrder}>
              Place Order 🍽
            </button>
          </div>
        </div>
      )}

      {totalCartQty === 0 && ['ordered', 'preparing', 'ready', 'served'].includes(orderStatus) && view === 'menu' && (
        <div className="floating-cart-bar" style={{ backgroundColor: '#10B981', cursor: 'pointer' }} onClick={() => setView('ordered')}>
          <div className="floating-cart-content" style={{ justifyContent: 'center' }}>
            <button className="floating-cart-cta" style={{ backgroundColor: 'transparent', width: '100%', border: 'none' }}>
              🕒 Track Active Order ({orderStatus})
            </button>
          </div>
        </div>
      )}

      {/* Customization Modal */}
      {isCustomizeModalOpen && selectedCustomizeItem && (
        <div className="pos-dialog-overlay">
          <div className="pos-dark-frame dialog-box customization-modal">
            <div className="modal-header">
              <div className="modal-title-row">
                <span className="modal-emoji">{selectedCustomizeItem.emoji}</span>
                <h3>Customize {selectedCustomizeItem.name}</h3>
              </div>
              <button 
                type="button" 
                className="modal-close-x" 
                onClick={() => setIsCustomizeModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddToCart}>
              <div className="modal-body">
                {/* Spice Level Section (Show for non-drinks only) */}
                {selectedCustomizeItem.category !== 'Drinks' && (
                  <div className="customize-section">
                    <label className="section-label">Select Spice Level</label>
                    <div className="spice-button-group">
                      {['Mild', 'Medium', 'Hot'].map(level => (
                        <button
                          key={level}
                          type="button"
                          className={`spice-btn-option ${spiceLevel === level ? 'active' : ''}`}
                          onClick={() => setSpiceLevel(level)}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons Section */}
                <div className="customize-section">
                  <label className="section-label">Add Extras</label>
                  <div className="addons-grid">
                    {(selectedCustomizeItem.category === 'Drinks' 
                      ? ['Extra Ice (Free)', 'Extra Sweetener (+₹10)', 'Add Ice Cream Scoop (+₹30)']
                      : ['Extra Cheese (+₹40)', 'Extra Butter (+₹20)', 'Extra Veggies (+₹50)']
                    ).map(addon => {
                      const isChecked = selectedAddons.includes(addon);
                      return (
                        <label key={addon} className={`addon-checkbox-label ${isChecked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            className="addon-input-hidden"
                            checked={isChecked}
                            onChange={() => handleToggleAddon(addon)}
                          />
                          <span className="addon-check-box"></span>
                          <span className="addon-name-label">{addon}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Special Instructions */}
                <div className="customize-section">
                  <label className="section-label">Special Instructions</label>
                  <textarea
                    className="modal-instructions-textarea"
                    placeholder="e.g. no onions, make it extra dry, server hot..."
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setIsCustomizeModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary modal-submit-btn">
                  Add to Cart — ₹{getModalItemPrice()}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
