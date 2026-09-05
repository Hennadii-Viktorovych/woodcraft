/**
 * js/cart.js — WoodCraft UA
 * Спільна логіка кошика для всіх сторінок.
 * Підключати ПЕРШИМ перед іншими скриптами.
 */

const API = './admin/admin.php';

// ── СТАН ──────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('wc_cart') || '[]');

// ── ОПЕРАЦІЇ З КОШИКОМ ────────────────────────────────
function cartAdd(product) {
    const ex = cart.find(i => i.id === product.id);
    if (ex) ex.qty++;
    else cart.push({
        id:    product.id,
        name:  product.name,
        price: product.price,
        image: product.image || '',
        qty:   1,
    });
    cartSave();
    cartUpdateUI();
    cartRenderDrawer();
    cartOpen();
    showToast('"' + product.name + '" додано до кошика');
}

function cartChangeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
    cartSave();
    cartUpdateUI();
    cartRenderDrawer();
}

function cartRemove(id) {
    cart = cart.filter(i => i.id !== id);
    cartSave();
    cartUpdateUI();
    cartRenderDrawer();
}

function cartSave() {
    localStorage.setItem('wc_cart', JSON.stringify(cart));
}

function cartClear() {
    cart = [];
    cartSave();
    cartUpdateUI();
}

function cartTotal() {
    return cart.reduce((s, i) => s + i.price * i.qty, 0);
}

function cartCount() {
    return cart.reduce((s, i) => s + i.qty, 0);
}

// ── ОНОВЛЕННЯ UI В ХЕДЕРІ ─────────────────────────────
function cartUpdateUI() {
    const count = cartCount();
    const total = cartTotal();

    // Варіант 1: хедер сайту (.cart__badge / .cart__total)
    const badge1 = document.querySelector('.cart__badge');
    const total1 = document.querySelector('.cart__total');
    if (badge1) badge1.textContent = count || '';
    if (total1) total1.textContent = count ? fmtNum(total) + ' ₴' : '';

    // Варіант 2: хедер product.html (#cart-badge / #cart-lbl)
    const badge2 = document.getElementById('cart-badge');
    const lbl2   = document.getElementById('cart-lbl');
    if (badge2) {
        badge2.textContent = count;
        badge2.className   = count ? 'cart-badge-num show' : 'cart-badge-num';
    }
    if (lbl2) lbl2.textContent = count ? fmtNum(total) + ' ₴' : 'Кошик';
}

// ── DRAWER ────────────────────────────────────────────
function cartBuildDrawer() {
    if (document.getElementById('wc-cart-drawer')) return;

    // Стилі drawer — відповідають стилю сайту (світлий)
    const style = document.createElement('style');
    style.textContent = `
    #wc-cart-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.45);
      z-index: 500; opacity: 0;
      transition: opacity .3s;
      pointer-events: none;
    }
    #wc-cart-panel {
      position: fixed; top: 0; right: 0;
      height: 100vh; width: 400px; max-width: 95vw;
      background: #fff; color: #1a1714;
      z-index: 501;
      transform: translateX(110%);
      transition: transform .32s cubic-bezier(.4,0,.2,1);
      display: flex; flex-direction: column;
      box-shadow: -4px 0 32px rgba(0,0,0,.12);
      border-left: 1px solid #e0d9cf;
      font-family: 'Fira Sans', system-ui, sans-serif;
    }
    #wc-cart-drawer.open #wc-cart-overlay { opacity: 1; pointer-events: auto; }
    #wc-cart-drawer.open #wc-cart-panel   { transform: none; }

    .wc-drawer-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e0d9cf;
      flex-shrink: 0;
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 22px; font-weight: 700;
    }
    .wc-drawer-close {
      background: none; border: none; cursor: pointer;
      font-size: 22px; color: #7a7060; line-height: 1;
      transition: color .2s;
    }
    .wc-drawer-close:hover { color: #1a1714; }
    .wc-drawer-list  { flex: 1; overflow-y: auto; padding: 12px 24px; }
    .wc-drawer-foot  { padding: 16px 24px; border-top: 1px solid #e0d9cf; flex-shrink: 0; }
    .wc-drawer-total {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 26px; font-weight: 700;
      text-align: right; margin-bottom: 14px; color: #1a1714;
    }
    .wc-drawer-btn {
      width: 100%; padding: 15px;
      background: #c8a050; color: #fff;
      border: none; border-radius: 4px;
      font-family: 'Fira Sans', system-ui, sans-serif;
      font-size: 15px; font-weight: 500;
      cursor: pointer; transition: background .2s;
    }
    .wc-drawer-btn:hover { background: #a8802e; }

    .wc-cart-row {
      display: flex; gap: 12px;
      padding: 14px 0;
      border-bottom: 1px solid #ede8e0;
      align-items: flex-start;
    }
    .wc-cart-row:last-child { border: none; }
    .wc-cart-row img {
      width: 58px; height: 58px; object-fit: cover;
      border-radius: 2px; flex-shrink: 0;
      background: #ede8e0;
    }
    .wc-cart-row-info { flex: 1; min-width: 0; }
    .wc-cart-row-name {
      font-size: 13px; font-weight: 500;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .wc-cart-row-price { font-size: 12px; color: #7a7060; margin-top: 2px; }
    .wc-cart-qty { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .wc-qty-btn {
      width: 26px; height: 26px; border-radius: 2px;
      border: 1px solid #e0d9cf; background: none;
      color: #1a1714; cursor: pointer; font-size: 16px; line-height: 1;
      transition: border-color .15s;
    }
    .wc-qty-btn:hover { border-color: #c8a050; color: #c8a050; }
    .wc-qty-num { font-size: 13px; min-width: 20px; text-align: center; }
    .wc-cart-remove {
      background: none; border: none; cursor: pointer;
      color: #b0a898; font-size: 18px; padding: 2px; line-height: 1;
      flex-shrink: 0; transition: color .15s;
    }
    .wc-cart-remove:hover { color: #c0614a; }
    .wc-cart-empty {
      text-align: center; padding: 52px 0;
      color: #7a7060; font-size: 14px;
    }
    .wc-cart-empty span { display: block; font-size: 36px; margin-bottom: 10px; }
  `;
    document.head.appendChild(style);

    const drawer = document.createElement('div');
    drawer.id = 'wc-cart-drawer';
    drawer.innerHTML = `
    <div id="wc-cart-overlay" onclick="cartClose()"></div>
    <div id="wc-cart-panel">
      <div class="wc-drawer-head">
        <span>Кошик</span>
        <button class="wc-drawer-close" onclick="cartClose()">✕</button>
      </div>
      <div class="wc-drawer-list" id="wc-cart-list"></div>
      <div class="wc-drawer-foot">
        <div class="wc-drawer-total" id="wc-cart-total"></div>
        <button class="wc-drawer-btn" onclick="cartGoToOrder()">
          Оформити замовлення →
        </button>
      </div>
    </div>
  `;
    document.body.appendChild(drawer);
}

function cartRenderDrawer() {
    const list = document.getElementById('wc-cart-list');
    const tot  = document.getElementById('wc-cart-total');
    if (!list) return;

    if (!cart.length) {
        list.innerHTML = '<div class="wc-cart-empty"><span>🛒</span>Кошик порожній</div>';
        if (tot) tot.textContent = '';
        return;
    }

    list.innerHTML = cart.map(i => `
    <div class="wc-cart-row">
      <img src="${escAttr(i.image || './images/444.png')}"
           onerror="this.src='./images/444.png'"
           alt="${escAttr(i.name)}">
      <div class="wc-cart-row-info">
        <div class="wc-cart-row-name">${escHtml(i.name)}</div>
        <div class="wc-cart-row-price">${fmtNum(i.price)} ₴ / шт.</div>
        <div class="wc-cart-qty">
          <button class="wc-qty-btn" onclick="cartChangeQty('${i.id}',-1)">−</button>
          <span class="wc-qty-num">${i.qty}</span>
          <button class="wc-qty-btn" onclick="cartChangeQty('${i.id}',1)">+</button>
        </div>
      </div>
      <button class="wc-cart-remove" onclick="cartRemove('${i.id}')">✕</button>
    </div>
  `).join('');

    if (tot) tot.textContent = fmtNum(cartTotal()) + ' ₴';
}

function cartOpen() {
    cartRenderDrawer();
    document.getElementById('wc-cart-drawer')?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function cartClose() {
    document.getElementById('wc-cart-drawer')?.classList.remove('open');
    document.body.style.overflow = '';
}

function cartToggle() {
    document.getElementById('wc-cart-drawer')?.classList.contains('open')
        ? cartClose()
        : cartOpen();
}

function cartGoToOrder() {
    cartClose();
    window.location.href = 'order.html';
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, type = 'ok') {
    let t = document.getElementById('wc-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'wc-toast';
        const s = document.createElement('style');
        s.textContent = `
      #wc-toast {
        position: fixed; bottom: 28px; left: 50%;
        transform: translateX(-50%) translateY(12px);
        background: #1a1714; color: #fff;
        border-radius: 4px; padding: 12px 24px;
        font-size: 14px; font-family: 'Fira Sans', sans-serif;
        z-index: 9999; opacity: 0;
        transition: all .3s; pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 4px 20px rgba(0,0,0,.2);
      }
      #wc-toast.show { opacity: 1; transform: translateX(-50%); }
      #wc-toast.err  { background: #c0614a; }
      #wc-toast.ok   { background: #5a9e6a; }
    `;
        document.head.appendChild(s);
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className   = type === 'err' ? 'show err' : 'show ok';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = '', 3500);
}

// ── UTILS ─────────────────────────────────────────────
function escHtml(s = '') {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s = '') {
    return String(s).replace(/"/g, '&quot;');
}
function fmtNum(n) {
    return Number(n || 0).toLocaleString('uk-UA');
}