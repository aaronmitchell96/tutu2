// public/scripts/cart.js

function addToCart(product) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.push(product);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartIcon();
    toggleCartToolbar(true); // Ensure cart opens when an item is added
}

function displayCartItems() {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalContainer = document.getElementById('cartTotal');
    cartItemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.classList.add('cart-item');
        itemElement.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <p>${item.name} - $${parseFloat(item.price).toFixed(2)}</p>
            <button class="remove-item" data-index="${index}">Remove</button>
        `;
        cartItemsContainer.appendChild(itemElement);
        total += parseFloat(item.price);
    });

    cartTotalContainer.innerHTML = `Total: $${total.toFixed(2)}`;

    // Attach event listeners to remove buttons
    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', (event) => {
            removeCartItem(event.target.dataset.index);
        });
    });
}

function updateCartIcon() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartIcon = document.getElementById('cartIcon');
    cartIcon.innerHTML = `(${cart.length})`;
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
        price: document.getElementById('productPrice').innerText.replace('Price: $', ''), // Adjusted to remove 'Price: $'
        image: document.getElementById('productImage').src,
    };
    console.log('Product to add:', product); // Debugging log
    addToCart(product);
}

function toggleCartToolbar(forceOpen) {
    const toolbar = document.getElementById('cart-tab');
    if (forceOpen) {
        toolbar.classList.add('active');
    } else {
        toolbar.classList.toggle('active');
    }
    if (toolbar.classList.contains('active')) {
        displayCartItems();
    }
}

function removeCartItem(index) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.splice(index, 1); // Remove the item at the specified index
    localStorage.setItem('cart', JSON.stringify(cart));
    displayCartItems(); // Update the cart display
    updateCartIcon(); // Update the cart icon
}

// Close button functionality
document.getElementById('closeCartButton').addEventListener('click', () => {
    toggleCartToolbar();
});
