/**
 * js/order.js — WoodCraft UA
 * Логіка для order.html
 * Підключати після cart.js
 */

document.addEventListener('DOMContentLoaded', () => {
    cartUpdateUI();

    if (!cart.length) {
        document.getElementById('empty-state').style.display  = 'block';
        document.getElementById('left-col').style.display     = 'none';
        document.getElementById('right-col').style.display    = 'none';
    } else {
        renderOrderItems();
        renderOrderSummary();
    }
});

// ── РЕНДЕР ТОВАРІВ ────────────────────────────────────
function renderOrderItems() {
    const wrap  = document.getElementById('order-items');
    const count = cartCount();

    document.getElementById('items-count').textContent =
        count + ' ' + plural(count, 'товар', 'товари', 'товарів');

    wrap.innerHTML = cart.map(i => `
    <div class="order-row">
      <img src="${escAttr(i.image || './images/444.png')}"
           onerror="this.src='./images/444.png'"
           alt="${escAttr(i.name)}">
      <div class="order-row-info">
        <div class="order-row-name">${escHtml(i.name)}</div>
        <div class="order-row-unit">${fmtNum(i.price)} ₴ / шт.</div>
      </div>
      <div class="order-row-qty">
        <button class="qty-btn" onclick="orderChangeQty('${i.id}', -1)">−</button>
        <span class="qty-num">${i.qty}</span>
        <button class="qty-btn" onclick="orderChangeQty('${i.id}', 1)">+</button>
      </div>
      <div class="order-row-price">${fmtNum(i.price * i.qty)} ₴</div>
      <button class="order-row-remove" onclick="orderRemove('${i.id}')">✕</button>
    </div>
  `).join('');

    document.getElementById('order-total').textContent = fmtNum(cartTotal()) + ' ₴';
}

function renderOrderSummary() {
    const total    = cartTotal();
    const count    = cartCount();
    const delivery = total >= 2000 ? 'Безкоштовно' : '~70–100 ₴';

    document.getElementById('order-summary').innerHTML = `
    <div class="summary-row">
      <span>Товарів</span>
      <span>${count} шт.</span>
    </div>
    <div class="summary-row">
      <span>Сума</span>
      <span>${fmtNum(total)} ₴</span>
    </div>
    <div class="summary-row">
      <span>Доставка (Нова Пошта)</span>
      <span>${delivery}</span>
    </div>
    <div class="summary-row summary-row--total">
      <span>До сплати</span>
      <span>${fmtNum(total)} ₴</span>
    </div>
  `;
}

// ── ЗМІНА КІЛЬКОСТІ / ВИДАЛЕННЯ ───────────────────────
function orderChangeQty(id, delta) {
    const item = cart.find(x => x.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(x => x.id !== id);
    if (!cart.length) { cartSave(); location.reload(); return; }
    cartSave();
    cartUpdateUI();
    renderOrderItems();
    renderOrderSummary();
}

function orderRemove(id) {
    cart = cart.filter(x => x.id !== id);
    if (!cart.length) { cartSave(); location.reload(); return; }
    cartSave();
    cartUpdateUI();
    renderOrderItems();
    renderOrderSummary();
}

// ── ВІДПРАВКА ЗАМОВЛЕННЯ ──────────────────────────────
async function submitOrder() {
    const name     = document.getElementById('f-name').value.trim();
    const phone    = document.getElementById('f-phone').value.trim();
    const delivery = document.getElementById('f-delivery').value.trim();
    const comment  = document.getElementById('f-comment').value.trim();

    if (!name)  { showToast('Введіть ваше ім\'я', 'err');    document.getElementById('f-name').focus();  return; }
    if (!phone) { showToast('Введіть номер телефону', 'err'); document.getElementById('f-phone').focus(); return; }

    const btn = document.getElementById('submit-btn');
    btn.disabled    = true;
    btn.textContent = 'Надсилаємо…';

    const message = [
        delivery ? 'Доставка: ' + delivery : '',
        comment,
    ].filter(Boolean).join('\n');

    try {
        const res  = await fetch(API + '?action=submit_order', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, phone, message, cart }),
        });
        const data = await res.json();

        if (data.ok) {
            cartClear();
            document.getElementById('left-col').style.display    = 'none';
            document.getElementById('right-col').style.display   = 'none';
            document.getElementById('page-title').style.display  = 'none';
            document.getElementById('success-screen').classList.add('show');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            throw new Error(data.error || 'Помилка сервера');
        }
    } catch (e) {
        showToast(e.message, 'err');
        btn.disabled    = false;
        btn.textContent = 'Підтвердити замовлення';
    }
}

// ── УТИЛІТА ───────────────────────────────────────────
function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}