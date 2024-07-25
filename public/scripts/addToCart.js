// public/scripts/cart.js

function addToCart(product) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.push(product);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartIcon();
}

function displayCartItems() {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalContainer = document.getElementById('cartTotal');
    cartItemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.classList.add('cart-item');
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <p>${item.name} - $${parseFloat(item.price).toFixed(2)}</p>
        `;
        cartItemsContainer.appendChild(itemElement);
        total += parseFloat(item.price);
    });

    cartTotalContainer.innerHTML = `Total: $${total.toFixed(2)}`;
}

function updateCartIcon() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartIcon = document.getElementById('cartIcon');
    cartIcon.innerHTML = `Cart (${cart.length})`;
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartIcon();
    const addToCartButton = document.getElementById('addToCartButton');
    if (addToCartButton) {
        addToCartButton.removeEventListener('click', handleAddToCart); // Remove any existing listeners
        addToCartButton.addEventListener('click', handleAddToCart);
    }
});

function handleAddToCart() {
    console.log('Add to Cart button clicked'); // Debugging log
    const product = {
        name: document.getElementById('productName').innerText.replace('Name: ', ''),
        price: document.getElementById('productPrice').innerText, // Remove 'Price: '
        image: document.getElementById('productImage').src,
    };
    console.log('Product to add:', product); // Debugging log
    addToCart(product);
}
