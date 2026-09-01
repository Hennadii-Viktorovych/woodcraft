/* =========================================================
      СЛАЙДЕР ПОПУЛЯРНИХ ТОВАРІВ
   ========================================================= */

function initPopularSlider() {

    const slider =
        document.querySelector("#popularProducts");

    const prevButton =
        document.querySelector(".popular__arrow--left");

    const nextButton =
        document.querySelector(".popular__arrow--right");

    if (!slider) return;


    const originalCards =
        Array.from(
            slider.querySelectorAll(".popular__slider-card")
        );


    if (originalCards.length === 0) return;


    const cardsCount = originalCards.length;


    /*
     * Якщо карток мало,
     * все одно створюємо достатньо копій
     * для нормального безкінечного руху.
     */

    originalCards
        .slice()
        .reverse()
        .forEach(card => {

            const clone = card.cloneNode(true);

            clone.dataset.clone = "true";

            slider.insertBefore(
                clone,
                slider.firstChild
            );

        });


    originalCards.forEach(card => {

        const clone = card.cloneNode(true);

        clone.dataset.clone = "true";

        slider.appendChild(clone);

    });


    const allCards =
        slider.querySelectorAll(
            ".popular__slider-card"
        );


    let currentIndex = cardsCount;

    let autoSlide = null;

    let isAnimating = false;


    /* =====================================================
       РОЗМІР КАРТКИ
    ===================================================== */

    function getStep() {

        const firstCard = allCards[0];

        if (!firstCard) return 0;

        const cardWidth =
            firstCard.getBoundingClientRect().width;

        const sliderStyle =
            window.getComputedStyle(slider);

        const gap =
            parseFloat(sliderStyle.gap) || 0;

        return cardWidth + gap;

    }


    /* =====================================================
       РУХ СЛАЙДЕРА
    ===================================================== */

    function moveSlider(animate = true) {

        const step = getStep();

        if (!step) return;

        slider.style.transition =
            animate
                ? "transform 0.5s ease"
                : "none";

        slider.style.transform =
            `translateX(-${currentIndex * step}px)`;

    }


    /* =====================================================
       NEXT
    ===================================================== */

    function nextSlide() {

        if (isAnimating) return;

        isAnimating = true;

        currentIndex++;

        moveSlider(true);

    }


    /* =====================================================
       PREVIOUS
    ===================================================== */

    function prevSlide() {

        if (isAnimating) return;

        isAnimating = true;

        currentIndex--;

        moveSlider(true);

    }


    /* =====================================================
       ЗАВЕРШЕННЯ АНІМАЦІЇ
    ===================================================== */

    slider.addEventListener(
        "transitionend",
        () => {

            /*
             * Перейшли у праві клони
             */

            if (currentIndex >= cardsCount * 2) {

                currentIndex = cardsCount;

                moveSlider(false);

            }


            /*
             * Перейшли у ліві клони
             */

            else if (currentIndex < cardsCount) {

                currentIndex =
                    cardsCount * 2 - 1;

                moveSlider(false);

            }

            isAnimating = false;

        }
    );


    /* =====================================================
       КНОПКА NEXT
    ===================================================== */

    if (nextButton) {

        nextButton.addEventListener(
            "click",
            () => {

                nextSlide();

                restartAutoSlide();

            }
        );

    }


    /* =====================================================
       КНОПКА PREVIOUS
    ===================================================== */

    if (prevButton) {

        prevButton.addEventListener(
            "click",
            () => {

                prevSlide();

                restartAutoSlide();

            }
        );

    }


    /* =====================================================
       AUTOPLAY
    ===================================================== */

    function startAutoSlide() {

        stopAutoSlide();

        autoSlide =
            setInterval(
                () => {

                    nextSlide();

                },
                3000
            );

    }


    function stopAutoSlide() {

        if (autoSlide) {

            clearInterval(autoSlide);

            autoSlide = null;

        }

    }


    function restartAutoSlide() {

        stopAutoSlide();

        startAutoSlide();

    }


    /* =====================================================
       PAUSE HOVER
    ===================================================== */

    slider.addEventListener(
        "mouseenter",
        () => {

            stopAutoSlide();

        }
    );


    slider.addEventListener(
        "mouseleave",
        () => {

            startAutoSlide();

        }
    );


    /* =====================================================
       RESIZE
    ===================================================== */

    window.addEventListener(
        "resize",
        () => {

            moveSlider(false);

        }
    );


    /* =====================================================
       START
    ===================================================== */

    moveSlider(false);

    startAutoSlide();

}


/* =========================================================
   АНІМАЦІЯ СЕКЦІЙ
========================================================= */

function initScrollAnimations() {

    const sections =
        document.querySelectorAll(
            ".fade-in-section"
        );


    if (!sections.length) return;


    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(entry => {

                    if (entry.isIntersecting) {

                        entry.target.classList.add(
                            "is-visible"
                        );

                    }

                });

            },
            {
                threshold: 0.15
            }
        );


    sections.forEach(section => {

        observer.observe(section);

    });

}


// Додати у кінець public/index.js:
document.addEventListener("DOMContentLoaded", () => {
    initPopularSlider();
    initScrollAnimations();
});


document.addEventListener('DOMContentLoaded', () => {
    // Стан корзини (зберігаємо у localStorage)
    let cart = JSON.parse(localStorage.getItem('woodcraft_cart')) || [];

    // Елементи DOM
    const cartBtn = document.querySelector('.cart__btn');
    const cartBadge = document.querySelector('.cart__badge');
    const cartTotalHeader = document.querySelector('.cart__total');

    const cartModal = document.getElementById('cartModal');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartClose = document.getElementById('cartClose');
    const cartItemsList = document.getElementById('cartItemsList');
    const cartModalTotal = document.getElementById('cartModalTotal');
    const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');

    // Оновлення відображення корзини
    function updateCartUI() {
        // Збереження у браузері
        localStorage.setItem('woodcraft_cart', JSON.stringify(cart));

        // Розрахунок кількості та суми
        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Оновлення Хедера
        if (cartBadge) cartBadge.textContent = totalCount;
        if (cartTotalHeader) cartTotalHeader.textContent = `${totalPrice} ₴`;
        if (cartModalTotal) cartModalTotal.textContent = `${totalPrice} ₴`;

        // Вивід товарів у поп-апі
        if (!cartItemsList) return;

        if (cart.length === 0) {
            cartItemsList.innerHTML = '<p style="text-align:center; color:#888; padding:30px 0;">Кошик порожній</p>';
            return;
        }

        cartItemsList.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.title}" class="cart-item__img">
                <div class="cart-item__info">
                    <div class="cart-item__title">${item.title}</div>
                    <div class="cart-item__price">${item.price} ₴</div>
                    <div class="cart-item__qty">
                        <button class="cart-item__qty-btn" onclick="changeQuantity(${item.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="cart-item__qty-btn" onclick="changeQuantity(${item.id}, 1)">+</button>
                    </div>
                </div>
                <button class="cart-item__remove" onclick="removeFromCart(${item.id})">&times;</button>
            </div>
        `).join('');
    }

    // Додавання товару в корзину
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const btn = e.target;
            const id = btn.getAttribute('data-id');
            const title = btn.getAttribute('data-title');
            const price = parseFloat(btn.getAttribute('data-price')) || 0;
            const image = btn.getAttribute('data-image');

            const existingItem = cart.find(item => item.id == id);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                cart.push({ id, title, price, image, quantity: 1 });
            }

            updateCartUI();
            openCartModal();
        }
    });

    // Зміна кількості (+ / -)
    window.changeQuantity = function(id, delta) {
        const item = cart.find(item => item.id == id);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                removeFromCart(id);
                return;
            }
            updateCartUI();
        }
    };

    // Видалення товару
    window.removeFromCart = function(id) {
        cart = cart.filter(item => item.id != id);
        updateCartUI();
    };

    // Відкрити/Закрити модалку
    function openCartModal() {
        if (cartModal) cartModal.classList.add('active');
    }
    function closeCartModal() {
        if (cartModal) cartModal.classList.remove('active');
    }

    if (cartBtn) cartBtn.addEventListener('click', openCartModal);
    if (cartClose) cartClose.addEventListener('click', closeCartModal);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCartModal);

    // Автоматично заповнювати форму при кліку на "Оформити"
    if (cartCheckoutBtn) {
        cartCheckoutBtn.addEventListener('click', () => {
            closeCartModal();
            const contactsSection = document.getElementById('contacts');
            if (contactsSection) {
                contactsSection.scrollIntoView({ behavior: 'smooth' });

                // Переносимо список товарів у текстове поле форми
                const messageTextarea = document.getElementById('message');
                if (messageTextarea) {
                    const orderSummary = cart.map(i => `${i.title} (x${i.quantity}) - ${i.price * i.quantity}грн`).join('\n');
                    messageTextarea.value = `Хочу замовити:\n${orderSummary}\n\nЗагальна сума: ${cartModalTotal.textContent}`;
                }
            }
        });
    }

    // Первинна ініціалізація
    updateCartUI();
});