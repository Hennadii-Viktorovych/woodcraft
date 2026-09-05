    const API = './admin/admin.php';
    let cart = JSON.parse(localStorage.getItem('wc_cart') || '[]');
    let allProducts = [];
    let currentProduct = null;

    document.addEventListener('DOMContentLoaded', async () => {
    updateCartUI();
    await loadProducts();
    const id = new URLSearchParams(location.search).get('id');
    if (id) showProduct(id);
    else location.href = 'index.html';
});

    async function loadProducts() {
    try {
    const res  = await fetch(API + '?action=get_products');
    const data = await res.json();
    if (data.ok) allProducts = data.products || [];
} catch {}
}

    function showProduct(id) {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('loading').style.display = 'none';

    if (!p) {
    document.body.innerHTML += `
      <div style="text-align:center;padding:100px 20px;color:#7a7060">
        <p style="font-size:18px;margin-bottom:16px">Товар не знайдено</p>
        <a href="index.html" style="color:#c8a050">← На головну</a>
      </div>`;
    return;
}

    currentProduct = p;
    document.title = p.name + ' — WoodCraft';
    document.getElementById('bc-name').textContent = p.name;
    document.getElementById('p-cat').textContent   = p.category || '';
    document.getElementById('p-name').textContent  = p.name;
    document.getElementById('p-short').textContent = p.short_desc || '';

    // Ціна
    document.getElementById('p-price').textContent = fmt(p.price) + ' ₴';
    if (p.old_price) {
    document.getElementById('p-old').textContent = fmt(p.old_price) + ' ₴';
    document.getElementById('p-sale').style.display = 'inline';
}

    // Фічі
    const feats = p.features || [];
    document.getElementById('p-feats').innerHTML = feats.map(f =>
    `<span class="feat">${xe(f)}</span>`
    ).join('');

    // Галерея
    const imgs = p.images?.length ? p.images : [p.image || './images/444.png'];
    const mainImg = document.getElementById('main-img');
    mainImg.src = imgs[0];
    mainImg.alt = p.name;

    const thumbsEl = document.getElementById('thumbs');
    if (imgs.length > 1) {
    thumbsEl.innerHTML = imgs.map((src, i) => `
      <div class="thumb ${i===0?'active':''}" onclick="switchImg(this,'${xa(src)}')">
        <img src="${xa(src)}" onerror="this.src='./images/444.png'" alt="">
      </div>
    `).join('');
}

    // Характеристики
    const specs = p.specs || {};
    document.getElementById('p-specs').innerHTML = Object.entries(specs).map(([k,v]) => `
    <div class="spec-row">
      <span class="spec-key">${xe(k)}</span>
      <span class="spec-val">${xe(v)}</span>
    </div>
  `).join('');

    // Опис
    document.getElementById('p-desc').textContent = p.description || '';
    document.getElementById('product-wrap').style.display = 'grid';

    // Схожі товари
    const rel = allProducts.filter(x => x.id !== id && x.in_stock).slice(0, 3);
    if (rel.length) {
    document.getElementById('related-grid').innerHTML = rel.map(r => `
      <a class="related-card" href="product.html?id=${r.id}">
        <img src="${xa((r.images||[])[0]||r.image||'./images/444.png')}"
             onerror="this.src='./images/444.png'" alt="${xa(r.name)}">
        <div class="related-card-body">
          <div class="related-card-name">${xe(r.name)}</div>
          <div class="related-card-price">${fmt(r.price)} ₴</div>
        </div>
      </a>
    `).join('');
    document.getElementById('related').style.display = 'block';
}
}

    function switchImg(thumb, src) {
    document.getElementById('main-img').src = src;
    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
}

    // ── КОШИК ─────────────────────────────────────────────
    function addToCartCurrent() {
    if (!currentProduct) return;
    const p  = currentProduct;
    const ex = cart.find(i => i.id === p.id);
    if (ex) ex.qty++;
    else cart.push({ id: p.id, name: p.name, price: p.price, image: (p.images||[])[0]||p.image||'', qty: 1 });
    saveCart(); updateCartUI(); renderCart(); openCart();
    toast('Додано до кошика');
}

    function buyNow() {
    addToCartCurrent();
    setTimeout(() => { closeCart(); window.location.href = 'order.html'; }, 350);
}

    function changeQty(id, d) {
    const i = cart.find(x => x.id === id);
    if (!i) return;
    i.qty += d;
    if (i.qty <= 0) cart = cart.filter(x => x.id !== id);
    saveCart(); updateCartUI(); renderCart();
}
    function removeItem(id) {
    cart = cart.filter(x => x.id !== id);
    saveCart(); updateCartUI(); renderCart();
}
    function saveCart() { localStorage.setItem('wc_cart', JSON.stringify(cart)); }

    function updateCartUI() {
    const count = cart.reduce((s,i) => s+i.qty, 0);
    const total = cart.reduce((s,i) => s+i.price*i.qty, 0);
    const badge = document.getElementById('cart-badge');
    const lbl   = document.getElementById('cart-lbl');
    if (badge) { badge.textContent = count; badge.className = count ? 'cart-badge-num show' : 'cart-badge-num'; }
    if (lbl)   lbl.textContent = count ? fmt(total) + ' ₴' : 'Кошик';
}

    function renderCart() {
    const list = document.getElementById('wc-cart-list');
    const tot  = document.getElementById('wc-cart-total');
    if (!list) return;
    if (!cart.length) {
    list.innerHTML = '<p style="text-align:center;padding:48px 0;color:#7a7060;font-size:14px">Кошик порожній</p>';
    if (tot) tot.textContent = '';
    return;
}
    list.innerHTML = cart.map(i => `
    <div class="cart-row">
      <img src="${xa(i.image||'./images/444.png')}" onerror="this.src='./images/444.png'" alt="${xa(i.name)}">
      <div class="cart-row-info">
        <div class="cart-row-name">${xe(i.name)}</div>
        <div class="cart-row-price">${fmt(i.price)} ₴ / шт.</div>
        <div class="cart-qty">
          <button class="qty-btn" onclick="changeQty('${i.id}',-1)">−</button>
          <span class="qty-num">${i.qty}</span>
          <button class="qty-btn" onclick="changeQty('${i.id}',1)">+</button>
        </div>
      </div>
      <button class="cart-remove" onclick="removeItem('${i.id}')">✕</button>
    </div>
  `).join('');
    if (tot) tot.textContent = fmt(cart.reduce((s,i)=>s+i.price*i.qty,0)) + ' ₴';
}

    function openCart()   { renderCart(); document.getElementById('wc-cart-drawer').classList.add('open');    document.body.style.overflow='hidden'; }
    function closeCart()  {              document.getElementById('wc-cart-drawer').classList.remove('open'); document.body.style.overflow=''; }
    function toggleCart() { document.getElementById('wc-cart-drawer').classList.contains('open') ? closeCart() : openCart(); }
    function goToOrder()  { closeCart(); window.location.href = 'order.html'; }

    function toast(msg, type='ok') {
    const t = document.getElementById('wc-toast');
    t.textContent = msg; t.className = type==='err'?'show err':'show ok';
    clearTimeout(t._t); t._t = setTimeout(()=>t.className='', 3500);
}
    function xe(s=''){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    function xa(s=''){return String(s).replace(/"/g,'&quot;');}
    function fmt(n){return Number(n||0).toLocaleString('uk-UA');}
