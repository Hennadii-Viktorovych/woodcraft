/**
 * index.js — WoodCraft UA
 * Підключати на index.html і catalog.html
 * НЕ підключати на order.html (у нього свій скрипт)
 */

const API = './admin/admin.php';
let cart        = JSON.parse(localStorage.getItem('wc_cart') || '[]');
let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    initFadeIn();
    initSlider();
    buildCartDrawer();
    updateCartUI();
    loadProducts();
    document.querySelector('.cart__btn')?.addEventListener('click', toggleCart);
});

// ── ТОВАРИ ────────────────────────────────────────────
async function loadProducts() {
    try {
        const res  = await fetch(API + '?action=get_products');
        const data = await res.json();
        if (!data.ok) return;
        allProducts = data.products || [];
        renderCatalog(allProducts);
    } catch { /* PHP не запущений — статичний HTML */ }
}

function renderCatalog(products) {
    const grid = document.querySelector('.catalog__grid');
    if (!grid) return;
    const list = products.filter(p => p.in_stock);
    if (!list.length) return;
    grid.innerHTML = list.map(p => `
    <div class="catalog__card" style="cursor:pointer" onclick="openProduct('${p.id}')">
      <div class="card__image-wrapper">
        <img src="${xa((p.images||[])[0]||p.image||'./images/444.png')}" alt="${xa(p.name)}" class="card__image" onerror="this.src='./images/444.png'">
        <div class="card__overlay">
          <h3 class="card__title">${xe(p.name)}</h3>
          <p class="card__description">${xe(p.short_desc||p.description||'')}</p>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto">
            <span class="card__price">${fmt(p.price)} ₴</span>
            <button onclick="event.stopPropagation();addToCart('${p.id}')"
              style="background:#fff;color:#141210;border:none;border-radius:6px;
                     padding:6px 14px;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap">
              + До кошика
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function openProduct(id) {
    window.location.href = 'product.html?id=' + id;
}

// ── КОШИК ─────────────────────────────────────────────
function addToCart(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    const ex = cart.find(i => i.id === id);
    if (ex) ex.qty++;
    else cart.push({ id: p.id, name: p.name, price: p.price, image: p.image||'', qty: 1 });
    saveCart(); updateCartUI(); renderCartItems(); openCart();
    toast('"' + p.name + '" додано до кошика');
}

// Для статичних карток в HTML (без PHP)
function addStaticToCart(btn) {
    const wrap  = btn.closest('.card__image-wrapper, .catalog__card');
    const name  = wrap?.querySelector('.card__title')?.textContent?.trim() || 'Товар';
    const price = parseFloat((wrap?.querySelector('.card__price')?.textContent||'0').replace(/[^\d.]/g,'')) || 0;
    const image = wrap?.querySelector('img')?.src || '';
    const id    = 'static_' + btoa(encodeURIComponent(name)).slice(0,12);

    const ex = cart.find(i => i.id === id);
    if (ex) ex.qty++;
    else cart.push({ id, name, price, image, qty: 1 });
    saveCart(); updateCartUI(); renderCartItems(); openCart();
    toast('"' + name + '" додано до кошика');
}

function changeQty(id, d) {
    const i = cart.find(x => x.id === id);
    if (!i) return;
    i.qty += d;
    if (i.qty <= 0) cart = cart.filter(x => x.id !== id);
    saveCart(); updateCartUI(); renderCartItems();
}

function removeItem(id) {
    cart = cart.filter(x => x.id !== id);
    saveCart(); updateCartUI(); renderCartItems();
}

function saveCart() { localStorage.setItem('wc_cart', JSON.stringify(cart)); }

function updateCartUI() {
    const count = cart.reduce((s,i) => s+i.qty, 0);
    const total = cart.reduce((s,i) => s+i.price*i.qty, 0);
    const badge = document.querySelector('.cart__badge');
    const tot   = document.querySelector('.cart__total');
    if (badge) badge.textContent = count || '';
    if (tot)   tot.textContent   = count ? fmt(total)+' ₴' : '';
}

function renderCartItems() {
    const list = document.getElementById('wc-cart-list');
    const foot = document.getElementById('wc-cart-total');
    if (!list) return;

    if (!cart.length) {
        list.innerHTML = '<p style="text-align:center;padding:48px 0;color:#7a7060;font-size:14px">Кошик порожній</p>';
        if (foot) foot.textContent = '';
        return;
    }

    list.innerHTML = cart.map(i => `
    <div style="display:flex;gap:12px;padding:13px 0;border-bottom:1px solid #2e2a24;align-items:flex-start">
      <img src="${xa(i.image||'./images/444.png')}" onerror="this.src='./images/444.png'"
        style="width:54px;height:54px;object-fit:cover;border-radius:7px;flex-shrink:0;background:#252118">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${xe(i.name)}</div>
        <div style="font-size:12px;color:#7a7060;margin-top:3px">${fmt(i.price)} ₴ / шт.</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <button onclick="changeQty('${i.id}',-1)" style="width:26px;height:26px;border-radius:5px;border:1px solid #2e2a24;background:none;color:#e8e0d4;cursor:pointer;font-size:16px">−</button>
          <span style="font-size:14px;min-width:20px;text-align:center">${i.qty}</span>
          <button onclick="changeQty('${i.id}',1)" style="width:26px;height:26px;border-radius:5px;border:1px solid #2e2a24;background:none;color:#e8e0d4;cursor:pointer;font-size:16px">+</button>
        </div>
      </div>
      <button onclick="removeItem('${i.id}')" style="background:none;border:none;cursor:pointer;color:#7a7060;font-size:20px;padding:2px;line-height:1">✕</button>
    </div>
  `).join('');

    if (foot) foot.textContent = fmt(cart.reduce((s,i)=>s+i.price*i.qty,0)) + ' ₴';
}

// ── DRAWER ────────────────────────────────────────────
function buildCartDrawer() {
    if (document.getElementById('wc-cart-drawer')) return;
    const el = document.createElement('div');
    el.id = 'wc-cart-drawer';
    el.innerHTML = `
    <div id="wc-overlay" onclick="closeCart()"></div>
    <div id="wc-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:18px 22px;border-bottom:1px solid #2e2a24;flex-shrink:0">
        <span style="font-size:18px;font-weight:600">🛒 Кошик</span>
        <button onclick="closeCart()"
          style="background:none;border:none;cursor:pointer;font-size:24px;color:#e8e0d4;line-height:1">✕</button>
      </div>
      <div id="wc-cart-list" style="flex:1;overflow-y:auto;padding:14px 22px"></div>
      <div style="padding:16px 22px;border-top:1px solid #2e2a24;flex-shrink:0">
        <div id="wc-cart-total"
          style="font-size:22px;font-weight:700;text-align:right;margin-bottom:14px;color:#c8a96e"></div>
        <button onclick="goToOrder()"
          style="width:100%;padding:15px;background:#c8a96e;color:#141210;border:none;
                 border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;
                 transition:background .2s"
          onmouseover="this.style.background='#a8894e'"
          onmouseout="this.style.background='#c8a96e'">
          Оформити замовлення →
        </button>
      </div>
    </div>
  `;
    const st = document.createElement('style');
    st.textContent = `
    #wc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;
      opacity:0;transition:opacity .3s;pointer-events:none}
    #wc-panel{position:fixed;top:0;right:0;height:100vh;width:380px;max-width:95vw;
      background:#1d1a17;color:#e8e0d4;z-index:501;
      transform:translateX(110%);transition:transform .32s cubic-bezier(.4,0,.2,1);
      display:flex;flex-direction:column;box-shadow:-6px 0 32px rgba(0,0,0,.5)}
    #wc-cart-drawer.open #wc-overlay{opacity:1;pointer-events:auto}
    #wc-cart-drawer.open #wc-panel{transform:none}
  `;
    document.head.appendChild(st);
    document.body.appendChild(el);
}

function openCart()   { renderCartItems(); document.getElementById('wc-cart-drawer')?.classList.add('open');    document.body.style.overflow='hidden'; }
function closeCart()  {                    document.getElementById('wc-cart-drawer')?.classList.remove('open'); document.body.style.overflow=''; }
function toggleCart() { document.getElementById('wc-cart-drawer')?.classList.contains('open') ? closeCart() : openCart(); }

function goToOrder() {
    closeCart();
    window.location.href = 'order.html';
}

// ── СЛАЙДЕР ───────────────────────────────────────────
function initSlider() {
    const slider = document.querySelector('.popular__slider');
    const btnL   = document.querySelector('.popular__arrow--left');
    const btnR   = document.querySelector('.popular__arrow--right');
    if (!slider || !btnL || !btnR) return;
    const step = () => { const c=slider.querySelector('.popular__slider-card'); return c?c.offsetWidth+20:280; };
    btnL.addEventListener('click', () => slider.scrollBy({left:-step(),behavior:'smooth'}));
    btnR.addEventListener('click', () => slider.scrollBy({left: step(),behavior:'smooth'}));
}

// ── FADE-IN ────────────────────────────────────────────
function initFadeIn() {
    const st = document.createElement('style');
    st.textContent=`.fade-in-section{opacity:0;transform:translateY(20px);transition:opacity .6s,transform .6s}.fade-in-section.visible{opacity:1;transform:none}`;
    document.head.appendChild(st);
    const obs = new IntersectionObserver(entries=>entries.forEach(e=>{
        if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target);}
    }),{threshold:.1});
    document.querySelectorAll('.fade-in-section').forEach(el=>obs.observe(el));
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg, type='ok') {
    let t = document.getElementById('wc-toast');
    if (!t) {
        t = document.createElement('div'); t.id='wc-toast';
        const s = document.createElement('style');
        s.textContent=`#wc-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(12px);background:#1d1a17;color:#e8e0d4;border:1px solid #2e2a24;border-radius:10px;padding:12px 22px;font-size:14px;z-index:9999;opacity:0;transition:all .3s;pointer-events:none;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.4)}#wc-toast.show{opacity:1;transform:translateX(-50%)}#wc-toast.err{border-color:#c0614a;color:#e07a6a}#wc-toast.ok{border-color:#5a9e6a;color:#8abf8e}`;
        document.head.appendChild(s); document.body.appendChild(t);
    }
    t.textContent=msg; t.className=type==='err'?'show err':'show ok';
    clearTimeout(t._t); t._t=setTimeout(()=>t.className='',3500);
}

// ── UTILS ──────────────────────────────────────────────
function xe(s=''){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function xa(s=''){return String(s).replace(/"/g,'&quot;');}
function fmt(n){return Number(n||0).toLocaleString('uk-UA');}