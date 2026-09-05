/**
 * js/catalog.js — WoodCraft UA
 * Логіка для index.html і catalog.html
 * Підключати після cart.js
 */

let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    cartBuildDrawer();
    cartUpdateUI();
    loadProducts();
    initSlider();
    initFadeIn();

    // Кнопка кошика в хедері
    document.querySelector('.cart__btn')?.addEventListener('click', cartToggle);
});

// ── ЗАВАНТАЖЕННЯ ТОВАРІВ ──────────────────────────────
async function loadProducts() {
    try {
        const res  = await fetch(API + '?action=get_products');
        const data = await res.json();
        if (!data.ok) return;
        allProducts = data.products || [];
        renderCatalog(allProducts);
    } catch {
        // PHP не запущений — залишаємо статичний HTML
        initStaticCards();
    }
}

// ── РЕНДЕР КАТАЛОГУ ───────────────────────────────────
function renderCatalog(products) {
    const grid = document.querySelector('.catalog__grid');
    if (!grid) return;

    const inStock = products.filter(p => p.in_stock);
    if (!inStock.length) return; // залишаємо статичний HTML

    grid.innerHTML = inStock.map(p => {
        const img = (p.images || [])[0] || p.image || './images/444.png';
        return `
      <div class="catalog__card" onclick="goToProduct('${p.id}')">
        <div class="card__image-wrapper">
          <img src="${escAttr(img)}"
               alt="${escAttr(p.name)}"
               class="card__image"
               onerror="this.src='./images/444.png'">
          <div class="card__overlay">
            <h3 class="card__title">${escHtml(p.name)}</h3>
            <p class="card__description">${escHtml(p.short_desc || p.description || '')}</p>
            <div class="card__footer">
              <span class="card__price">${fmtNum(p.price)} ₴</span>
              <button class="card__add-btn"
                onclick="event.stopPropagation(); addProductToCart('${p.id}')">
                + До кошика
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

// ── ДОДАТИ В КОШИК (з динамічного каталогу) ──────────
function addProductToCart(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    cartAdd({
        id:    p.id,
        name:  p.name,
        price: p.price,
        image: (p.images || [])[0] || p.image || '',
    });
}

// ── ДОДАТИ В КОШИК (зі статичного HTML) ──────────────
function addStaticToCart(btn) {
    const wrap  = btn.closest('.catalog__card, .card__image-wrapper');
    const name  = wrap?.querySelector('.card__title')?.textContent?.trim() || 'Товар';
    const price = parseFloat(
        (wrap?.querySelector('.card__price')?.textContent || '0').replace(/[^\d.]/g, '')
    ) || 0;
    const image = wrap?.querySelector('img')?.src || '';
    const id    = 'static_' + btoa(encodeURIComponent(name)).slice(0, 12);

    cartAdd({ id, name, price, image });
}

// Ініціалізуємо кнопки на статичних картках
function initStaticCards() {
    document.querySelectorAll('.catalog__card').forEach(card => {
        // Клік по картці → сторінка товару (якщо є data-id)
        const id = card.dataset.id;
        if (id) card.addEventListener('click', () => goToProduct(id));
    });
}

// ── ПЕРЕХІД НА СТОРІНКУ ТОВАРУ ────────────────────────
function goToProduct(id) {
    window.location.href = 'product.html?id=' + id;
}

// ── СЛАЙДЕР ───────────────────────────────────────────
function initSlider() {
    const slider = document.querySelector('.popular__slider');
    const btnL   = document.querySelector('.popular__arrow--left');
    const btnR   = document.querySelector('.popular__arrow--right');
    if (!slider || !btnL || !btnR) return;

    const getStep = () => {
        const card = slider.querySelector('.popular__slider-card');
        return card ? card.offsetWidth + parseInt(getComputedStyle(slider).gap || 20) : 280;
    };

    btnL.addEventListener('click', () => slider.scrollBy({ left: -getStep(), behavior: 'smooth' }));
    btnR.addEventListener('click', () => slider.scrollBy({ left:  getStep(), behavior: 'smooth' }));
}

// ── FADE-IN ────────────────────────────────────────────
function initFadeIn() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                obs.unobserve(e.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in-section').forEach(el => obs.observe(el));
}