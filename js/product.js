/**
 * js/product.js — WoodCraft UA
 * Логіка для product.html
 * Підключати після cart.js
 */

let allProducts    = [];
let currentProduct = null;

document.addEventListener('DOMContentLoaded', async () => {
    cartBuildDrawer();
    cartUpdateUI();

    // Кнопка кошика в хедері product.html
    document.querySelector('.header-cart')?.addEventListener('click', cartToggle);

    await loadAllProducts();

    const id = new URLSearchParams(location.search).get('id');
    if (id) renderProduct(id);
    else window.location.href = 'index.html';
});

// ── ЗАВАНТАЖЕННЯ ──────────────────────────────────────
async function loadAllProducts() {
    try {
        const res  = await fetch(API + '?action=get_products');
        const data = await res.json();
        if (data.ok) allProducts = data.products || [];
    } catch {}
}

// ── РЕНДЕР СТОРІНКИ ТОВАРУ ────────────────────────────
function renderProduct(id) {
    const p = allProducts.find(x => x.id === id);

    document.getElementById('loading').style.display = 'none';

    if (!p) {
        document.getElementById('not-found').style.display = 'block';
        return;
    }

    currentProduct = p;
    document.title = p.name + ' — WoodCraft';

    // Хлібні крихти
    document.getElementById('bc-name').textContent = p.name;

    // Основна інфо
    document.getElementById('p-cat').textContent   = p.category || '';
    document.getElementById('p-name').textContent  = p.name;
    document.getElementById('p-short').textContent = p.short_desc || '';

    // Ціна
    document.getElementById('p-price').textContent = fmtNum(p.price) + ' ₴';
    const oldEl  = document.getElementById('p-old');
    const saleEl = document.getElementById('p-sale');
    if (p.old_price) {
        oldEl.textContent      = fmtNum(p.old_price) + ' ₴';
        saleEl.style.display   = 'inline';
    }

    // Переваги
    const featsEl = document.getElementById('p-feats');
    if (featsEl && p.features?.length) {
        featsEl.innerHTML = p.features.map(f => `<span class="feat">${escHtml(f)}</span>`).join('');
    }

    // Галерея
    const imgs = p.images?.length ? p.images : [p.image || './images/444.png'];
    const mainImg = document.getElementById('main-img');
    mainImg.src = imgs[0];
    mainImg.alt = p.name;

    const thumbsEl = document.getElementById('thumbs');
    if (imgs.length > 1) {
        thumbsEl.innerHTML = imgs.map((src, i) => `
      <div class="thumb ${i === 0 ? 'active' : ''}"
           onclick="switchThumb(this, '${escAttr(src)}')">
        <img src="${escAttr(src)}" onerror="this.src='./images/444.png'" alt="">
      </div>
    `).join('');
    }

    // Характеристики
    const specsEl = document.getElementById('p-specs');
    const specs   = p.specs || {};
    specsEl.innerHTML = Object.entries(specs).map(([k, v]) => `
    <div class="spec-row">
      <span class="spec-key">${escHtml(k)}</span>
      <span class="spec-val">${escHtml(v)}</span>
    </div>
  `).join('');

    // Опис
    document.getElementById('p-desc').textContent = p.description || '';

    // Показуємо сторінку
    document.getElementById('product-wrap').style.display = 'grid';

    // Схожі товари
    const related = allProducts
        .filter(x => x.id !== id && x.in_stock)
        .slice(0, 3);

    if (related.length) {
        const relGrid = document.getElementById('related-grid');
        relGrid.innerHTML = related.map(r => {
            const img = (r.images || [])[0] || r.image || './images/444.png';
            return `
        <a class="related-card" href="product.html?id=${r.id}">
          <img src="${escAttr(img)}" onerror="this.src='./images/444.png'" alt="${escAttr(r.name)}">
          <div class="related-card-body">
            <div class="related-card-name">${escHtml(r.name)}</div>
            <div class="related-card-price">${fmtNum(r.price)} ₴</div>
          </div>
        </a>
      `;
        }).join('');
        document.getElementById('related').style.display = 'block';
    }
}

// ── ГАЛЕРЕЯ ───────────────────────────────────────────
function switchThumb(thumb, src) {
    document.getElementById('main-img').src = src;
    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
}

// ── КОШИК ─────────────────────────────────────────────
function addCurrentToCart() {
    if (!currentProduct) return;
    const p = currentProduct;
    cartAdd({
        id:    p.id,
        name:  p.name,
        price: p.price,
        image: (p.images || [])[0] || p.image || '',
    });
}

function buyNow() {
    addCurrentToCart();
    setTimeout(() => {
        cartClose();
        window.location.href = 'order.html';
    }, 350);
}