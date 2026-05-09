(function() {
  'use strict';

  const API_BASE = '/api/v1';
  let currentUser = null;

  const getPage = () => document.body.dataset.page;
  const select = selector => document.querySelector(selector);

  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => htmlEscapeMap[char]);
  }

  function formatPrice(value) {
    return `\u20B1${Number(value || 0).toLocaleString('en-PH')}`;
  }

  async function apiRequest(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const init = {
      credentials: 'same-origin',
      ...options,
      headers
    };

    if (init.body && typeof init.body !== 'string') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(init.body);
    }

    const response = await fetch(`${API_BASE}${path}`, init);
    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { message: text || response.statusText };
    }

    if (!response.ok) {
      throw new Error(data.message || 'Request failed. Please try again.');
    }

    return data;
  }

  function setMessage(message = '', type = 'info') {
    const messageBox = select('[data-message]');
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `message${message ? ` message--${type}` : ''}`;
  }

  function renderAuthShell(user) {
    document.querySelectorAll('[data-auth-shell]').forEach(shell => {
      if (user) {
        shell.innerHTML = `
          <span class="user-pill">${escapeHtml(user.name || user.email)}</span>
          <button class="button button--secondary" type="button" data-logout>Logout</button>
        `;
        return;
      }

      shell.innerHTML = `
        <a class="button button--secondary" href="/login">Login</a>
        <a class="button" href="/signup">Sign Up</a>
      `;
    });
  }

  async function readCurrentUser() {
    try {
      const result = await apiRequest('/users/me');
      currentUser = result.data.user;
      renderAuthShell(currentUser);
      return currentUser;
    } catch (error) {
      currentUser = null;
      renderAuthShell(null);
      return null;
    }
  }

  async function requireAuth() {
    const user = await readCurrentUser();

    if (!user) {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.href = `/login?next=${next}`;
      throw new Error('Authentication required');
    }

    return user;
  }

  function getNextPath(defaultPath = '/overview') {
    const next = new URLSearchParams(window.location.search).get('next');
    return next || defaultPath;
  }

  function setActiveNav() {
    const page = getPage();
    const map = {
      overview: 'overview',
      item: 'overview',
      'product-form': 'add',
      stats: 'stats'
    };

    const activeKey = map[page];
    if (!activeKey) return;

    document.querySelectorAll('[data-nav]').forEach(link => {
      link.classList.toggle('is-active', link.dataset.nav === activeKey);
    });
  }

  function getProductId() {
    return new URLSearchParams(window.location.search).get('id');
  }

  function productSymbol(product) {
    return escapeHtml(product.image || '\uD83D\uDCE6');
  }

  function canDeleteProducts() {
    return currentUser && currentUser.role === 'admin';
  }

  function productCard(product) {
    const deleteButton = canDeleteProducts()
      ? `<button class="button button--danger" type="button" data-delete-product="${escapeHtml(product._id)}">Delete</button>`
      : '';

    return `
      <article class="product-card">
        <div class="product-symbol">${productSymbol(product)}</div>
        <h3 class="product-title">${escapeHtml(product.name)}</h3>
        <div class="price">${formatPrice(product.price)}</div>
        <p class="meta">${escapeHtml(product.category)} &bull; ${escapeHtml(product.location)}</p>
        <p class="meta">Seller: ${escapeHtml(product.seller)}</p>
        <div class="button-row">
          <a class="button" href="/item?id=${encodeURIComponent(product._id)}">View</a>
          <a class="button button--secondary" href="/add-item?id=${encodeURIComponent(product._id)}">Edit</a>
          ${deleteButton}
        </div>
      </article>
    `;
  }

  function buildProductQuery() {
    const form = select('#filterForm');
    const query = new URLSearchParams();
    if (!form) return query.toString();

    const formData = new FormData(form);
    const minPrice = formData.get('minPrice');
    const maxPrice = formData.get('maxPrice');
    const category = String(formData.get('category') || '').trim();
    const location = String(formData.get('location') || '').trim();
    const sortPrice = formData.get('sortPrice');

    if (minPrice) query.set('price[gte]', minPrice);
    if (maxPrice) query.set('price[lte]', maxPrice);
    if (category) query.set('category', category);
    if (location) query.set('location', location);
    if (sortPrice) query.set('sort', sortPrice);

    return query.toString();
  }

  async function loadProducts() {
    const container = select('#product-list');
    const counter = select('#resultCount');
    if (!container) return;

    container.innerHTML = '<div class="empty-state">Loading products...</div>';
    if (counter) counter.textContent = '';

    try {
      const query = buildProductQuery();
      const result = await apiRequest(`/products${query ? `?${query}` : ''}`);
      const products = result.data.products || [];

      if (counter) {
        counter.textContent = `${products.length} product${products.length === 1 ? '' : 's'} found`;
      }

      container.innerHTML = products.length
        ? products.map(productCard).join('')
        : '<div class="empty-state">No products match the selected filters.</div>';
    } catch (error) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function fillDatalist(id, values) {
    const datalist = select(`#${id}`);
    if (!datalist) return;

    datalist.innerHTML = [...new Set(values.filter(Boolean).map(String))]
      .sort((a, b) => a.localeCompare(b))
      .map(value => `<option value="${escapeHtml(value)}"></option>`)
      .join('');
  }

  async function hydrateFilterOptions() {
    try {
      const result = await apiRequest('/products?fields=category,location,seller&limit=500');
      const products = result.data.products || [];
      fillDatalist('categoryOptions', products.map(product => product.category));
      fillDatalist('locationOptions', products.map(product => product.location));
    } catch (error) {
      // The main product load will show any auth or network error.
    }
  }

  function productPayloadFromForm(form) {
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      price: Number(formData.get('price')),
      category: String(formData.get('category') || '').trim(),
      location: String(formData.get('location') || '').trim(),
      seller: String(formData.get('seller') || '').trim(),
      description: String(formData.get('description') || '').trim()
    };
    const image = String(formData.get('image') || '').trim();
    if (image) payload.image = image;
    return payload;
  }

  function fillProductForm(product) {
    ['name', 'price', 'category', 'location', 'seller', 'image', 'description'].forEach(fieldName => {
      const field = select(`#${fieldName}`);
      if (field) field.value = product[fieldName] ?? '';
    });
  }

  async function deleteProduct(id) {
    if (!id || !window.confirm('Delete this product?')) return false;

    await apiRequest(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });

    if (getPage() === 'item') {
      window.location.href = '/overview';
      return true;
    }

    await loadProducts();
    return true;
  }

  async function initHome() {
    const user = await readCurrentUser();
    const container = select('#homeContent');
    if (!container) return;

    if (user) {
      container.innerHTML = `
        <h1>Marketplace Dashboard</h1>
        <p class="lead">Welcome back, ${escapeHtml(user.name)}. Manage product listings, review pricing, and check the cheapest products.</p>
        <div class="action-row">
          <a class="button" href="/overview">View Products</a>
          <a class="button button--success" href="/add-item">Add Product</a>
          <a class="button button--secondary" href="/stats">View Stats</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <h1>Local Marketplace</h1>
      <p class="lead">Login or create an account to browse products, manage listings, filter by price range, and view marketplace stats.</p>
      <div class="action-row">
        <a class="button" href="/login">Login</a>
        <a class="button button--secondary" href="/signup">Sign Up</a>
      </div>
    `;
  }

  async function initLogin() {
    const existingUser = await readCurrentUser();
    if (existingUser) {
      window.location.href = getNextPath('/overview');
      return;
    }

    const form = select('#loginForm');
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      setMessage('Logging in...');

      try {
        const formData = new FormData(form);
        await apiRequest('/login', {
          method: 'POST',
          body: {
            email: String(formData.get('email') || '').trim(),
            password: String(formData.get('password') || '')
          }
        });
        window.location.href = getNextPath('/overview');
      } catch (error) {
        setMessage(error.message, 'error');
      }
    });
  }

  async function initSignup() {
    const existingUser = await readCurrentUser();
    if (existingUser) {
      window.location.href = '/overview';
      return;
    }

    const form = select('#signupForm');
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      setMessage('Creating account...');

      try {
        const formData = new FormData(form);
        await apiRequest('/signup', {
          method: 'POST',
          body: {
            name: String(formData.get('name') || '').trim(),
            email: String(formData.get('email') || '').trim(),
            password: String(formData.get('password') || ''),
            passwordConfirm: String(formData.get('passwordConfirm') || '')
          }
        });
        window.location.href = '/overview';
      } catch (error) {
        setMessage(error.message, 'error');
      }
    });
  }

  async function initOverview() {
    await requireAuth();
    await hydrateFilterOptions();
    await loadProducts();

    const form = select('#filterForm');
    if (!form) return;

    form.addEventListener('submit', event => {
      event.preventDefault();
      loadProducts();
    });

    const clearButton = select('[data-clear-filters]');
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        form.reset();
        loadProducts();
      });
    }
  }

  async function initProductForm() {
    await requireAuth();

    const form = select('#productForm');
    if (!form) return;

    const productId = getProductId();
    const isEditing = Boolean(productId);

    if (isEditing) {
      select('#formTitle').textContent = 'Edit Product';
      select('#formIntro').textContent = 'Update the selected marketplace listing.';
      select('#submitProduct').textContent = 'Update Product';

      try {
        const result = await apiRequest(`/products/${encodeURIComponent(productId)}`);
        fillProductForm(result.data.product);
      } catch (error) {
        setMessage(error.message, 'error');
      }
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      setMessage(isEditing ? 'Updating product...' : 'Saving product...');

      try {
        const result = await apiRequest(isEditing ? `/products/${encodeURIComponent(productId)}` : '/products', {
          method: isEditing ? 'PATCH' : 'POST',
          body: productPayloadFromForm(form)
        });

        const savedProduct = result.data.product;
        window.location.href = `/item?id=${encodeURIComponent(savedProduct._id)}`;
      } catch (error) {
        setMessage(error.message, 'error');
      }
    });
  }

  async function initItem() {
    await requireAuth();

    const container = select('#product-detail');
    const productId = getProductId();

    if (!container) return;
    if (!productId) {
      container.innerHTML = '<div class="empty-state">No product selected.</div>';
      return;
    }

    try {
      const result = await apiRequest(`/products/${encodeURIComponent(productId)}`);
      const product = result.data.product;
      const deleteButton = canDeleteProducts()
        ? `<button class="button button--danger" type="button" data-delete-product="${escapeHtml(product._id)}">Delete Product</button>`
        : '';

      container.innerHTML = `
        <article class="detail-panel">
          <div class="detail-symbol">${productSymbol(product)}</div>
          <div class="detail-copy">
            <p class="meta">${escapeHtml(product.category)} &bull; ${escapeHtml(product.location)}</p>
            <h2>${escapeHtml(product.name)}</h2>
            <div class="price">${formatPrice(product.price)}</div>
            <p class="meta">Seller: ${escapeHtml(product.seller)}</p>
            <h3>Description</h3>
            <p>${escapeHtml(product.description)}</p>
            <div class="button-row">
              <a class="button button--secondary" href="/add-item?id=${encodeURIComponent(product._id)}">Edit Product</a>
              ${deleteButton}
            </div>
          </div>
        </article>
      `;
      setMessage('');
    } catch (error) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  async function initStats() {
    await requireAuth();

    const container = select('#stats-list');
    if (!container) return;

    try {
      const result = await apiRequest('/products/top-3-cheapest');
      const products = result.data.products || [];
      setMessage(products.length ? '' : 'No product data available.');

      container.innerHTML = products.length
        ? products.map((product, index) => `
          <article class="stat-card">
            <span class="rank">#${index + 1}</span>
            <h3>${escapeHtml(product.name)}</h3>
            <div class="price">${formatPrice(product.price)}</div>
            <p class="meta">${escapeHtml(product.category)} &bull; Seller: ${escapeHtml(product.seller)}</p>
          </article>
        `).join('')
        : '<div class="empty-state">No products found.</div>';
    } catch (error) {
      setMessage(error.message, 'error');
      container.innerHTML = '';
    }
  }

  document.addEventListener('click', async event => {
    const logoutButton = event.target.closest('[data-logout]');
    if (logoutButton) {
      logoutButton.disabled = true;
      try {
        await apiRequest('/logout');
      } finally {
        window.location.href = '/login';
      }
      return;
    }

    const deleteButton = event.target.closest('[data-delete-product]');
    if (deleteButton) {
      deleteButton.disabled = true;
      try {
        const deleted = await deleteProduct(deleteButton.dataset.deleteProduct);
        if (!deleted) deleteButton.disabled = false;
      } catch (error) {
        deleteButton.disabled = false;
        setMessage(error.message, 'error');
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    renderAuthShell(null);
    setActiveNav();

    const initializers = {
      home: initHome,
      login: initLogin,
      signup: initSignup,
      overview: initOverview,
      'product-form': initProductForm,
      item: initItem,
      stats: initStats
    };

    const initialize = initializers[getPage()];
    if (initialize) {
      initialize().catch(error => {
        if (error.message !== 'Authentication required') {
          setMessage(error.message, 'error');
        }
      });
    }
  });
})();
