import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import './AdminPanel.css';
import { API_URL } from './config';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Starters',
    emoji: '🍛',
    quantity: '10'
  });

  const fetchMenu = () => {
    setLoading(true);
    fetch(`${API_URL}/menu`)
      .then(res => res.json())
      .then(data => {
        setMenu(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch menu:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMenu();

    const socket = io(API_URL);

    socket.on('menu_updated', (updatedMenu) => {
      console.log('[Socket] Menu updated in admin panel:', updatedMenu);
      setMenu(updatedMenu);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleUpdateStock = (itemId, newQty) => {
    fetch(`${API_URL}/menu/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, quantity: newQty })
    })
      .then(res => {
        if (!res.ok) throw new Error('Stock update failed');
        return res.json();
      })
      .then(() => {
        fetchMenu();
      })
      .catch(err => {
        console.error(err);
        alert('Could not update stock. Please try again.');
      });
  };

  const handleToggleAvailability = (itemId) => {
    fetch(`${API_URL}/menu/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId })
    })
      .then(res => {
        if (!res.ok) throw new Error('Toggle failed');
        return res.json();
      })
      .then(() => {
        fetchMenu(); // Re-fetch menu to update state
      })
      .catch(err => {
        console.error(err);
        alert('Could not toggle availability. Please try again.');
      });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.category || !formData.emoji) {
      alert('Please fill out all required fields.');
      return;
    }

    fetch(`${API_URL}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to add item');
        return res.json();
      })
      .then(() => {
        setIsModalOpen(false);
        setFormData({
          name: '',
          description: '',
          price: '',
          category: 'Starters',
          emoji: '🍛',
          quantity: '10'
        });
        fetchMenu(); // Re-fetch menu to show new item
      })
      .catch(err => {
        console.error(err);
        alert('Could not add item. Please try again.');
      });
  };

  return (
    <div className="admin-layout">
      {/* Left Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2 className="admin-sidebar-title">RestauPOS Admin</h2>
        </div>
        <ul className="admin-nav-list">
          <li className="admin-nav-item active">
            📋 Menu Management
          </li>
          <li className="admin-nav-item" onClick={() => navigate('/staff')}>
            👔 Kitchen Dashboard
          </li>
          <li className="admin-nav-item" onClick={() => navigate('/')}>
            🏠 Go to Home
          </li>
        </ul>
      </aside>

      {/* Main Panel */}
      <main className="admin-main">
        {/* Top Navbar */}
        <div className="admin-topbar">
          <div className="admin-breadcrumb">
            Admin Dashboard &gt; Menu Management
          </div>
          <div>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              + Add Item
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="admin-content">
          <div className="admin-section-header">
            <h2>Menu Cards Overview</h2>
          </div>

          {loading ? (
            <p>Loading menu database...</p>
          ) : (
            <div className="admin-menu-grid">
              {menu.map(item => (
                <div key={item.id} className="admin-menu-card">
                  <div>
                    <div className="admin-card-header">
                      <span className="admin-card-emoji">{item.emoji}</span>
                      <span className="admin-card-price">₹{item.price}</span>
                    </div>
                    <h3 className="admin-card-title">{item.name}</h3>
                    <p className="admin-card-desc">{item.description || 'No description provided.'}</p>
                  </div>

                  <div className="admin-stock-control" style={{ margin: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed #E2E8F0', paddingTop: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text-body)' }}>
                      Stock: <strong>{item.quantity !== undefined ? item.quantity : 0}</strong>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '2px 8px', fontSize: '12px', minWidth: '24px', height: '24px' }}
                        onClick={() => handleUpdateStock(item.id, Math.max(0, (item.quantity || 0) - 1))}
                        disabled={(item.quantity || 0) <= 0}
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        value={item.quantity !== undefined ? item.quantity : 0} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          handleUpdateStock(item.id, isNaN(val) ? 0 : Math.max(0, val));
                        }}
                        style={{ width: '45px', textAlign: 'center', padding: '2px', fontSize: '12px', height: '24px', border: '1px solid #CBD5E1', borderRadius: '4px' }}
                        min="0"
                      />
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '2px 8px', fontSize: '12px', minWidth: '24px', height: '24px' }}
                        onClick={() => handleUpdateStock(item.id, (item.quantity || 0) + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="admin-card-footer">
                    <span className={`admin-availability-status ${item.available !== false ? 'available' : 'out-of-stock'}`}>
                      {item.available !== false ? '● Available' : '● Out of Stock'}
                    </span>
                    <button 
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '4px' }}
                      onClick={() => handleToggleAvailability(item.id)}
                    >
                      {item.available !== false ? 'Make Out of Stock' : 'Make Available'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Add New Menu Item</h3>
              <button className="admin-modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label className="admin-form-label">Item Name *</label>
                  <input 
                    type="text" 
                    name="name" 
                    className="win-input" 
                    value={formData.name} 
                    onChange={handleFormChange}
                    placeholder="e.g. Garlic Naan" 
                    required 
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Description</label>
                  <textarea 
                    name="description" 
                    className="win-input" 
                    style={{ height: '60px', resize: 'none' }}
                    value={formData.description} 
                    onChange={handleFormChange}
                    placeholder="e.g. Baked in tandoor with fresh garlic"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Price (in ₹) *</label>
                  <input 
                    type="text" 
                    name="price" 
                    className="win-input" 
                    value={formData.price} 
                    onChange={handleFormChange}
                    placeholder="e.g. 70" 
                    required 
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Quantity / Servings Available *</label>
                  <input 
                    type="number" 
                    name="quantity" 
                    className="win-input" 
                    value={formData.quantity} 
                    onChange={handleFormChange}
                    placeholder="e.g. 10" 
                    min="0"
                    required 
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Category *</label>
                  <select 
                    name="category" 
                    className="admin-form-select"
                    value={formData.category} 
                    onChange={handleFormChange}
                  >
                    <option value="Starters">Starters</option>
                    <option value="Mains">Mains</option>
                    <option value="Drinks">Drinks</option>
                  </select>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Emoji Icon *</label>
                  <input 
                    type="text" 
                    name="emoji" 
                    className="win-input" 
                    value={formData.emoji} 
                    onChange={handleFormChange}
                    placeholder="e.g. 🫓" 
                    required 
                  />
                </div>
              </div>
              
              <div className="admin-modal-footer">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
