let listProductHTML = document.querySelector('.listProduct');
let listCartHTML = document.querySelector('.listCart');
let iconCart = document.querySelector('.icon-cart');
let iconCartSpan = document.querySelector('.icon-cart span');
let body = document.querySelector('body');
let closeCart = document.querySelector('.close');
let products = [];
let cart = [];


iconCart.addEventListener('click', () => {
    body.classList.toggle('showCart');
})
closeCart.addEventListener('click', () => {
    body.classList.toggle('showCart');
})

const addDataToHTML = () => {
    // Remove default data from HTML
    listProductHTML.innerHTML = '';

    // Add new data
    if (products.length > 0) { // if there is data
        products.forEach(product => {
            if (!product.parent_id) {
                // If the product is a parent, create a new product item
                let newProduct = document.createElement('div');
                newProduct.dataset.id = product.id;
                newProduct.classList.add('item');
                newProduct.innerHTML = 
                `<a href="/image/${product.id}">
                    <img src="${product.path}" alt="${product.name}" class="parent-img">
                    <h2>${product.name}</h2>
                    <div class="price">$${product.price}</div>
                 </a>
                 <div class="color-circle-container"></div> <!-- Updated to ensure container exists -->
                 <button class="addCart">Add To Cart</button>`;
                listProductHTML.appendChild(newProduct);
            } else {
                // If the product is a child, append it as a color circle to the parent
                let parentElement = document.querySelector(`[data-id="${product.parent_id}"]`);
                if (parentElement) {
                    let colorCircleContainer = parentElement.querySelector('.color-circle-container');

                    // Create the color circle
                    let colorCircle = document.createElement('div');
                    colorCircle.classList.add('color-circle');
                    colorCircle.style.backgroundColor = product.color; // Set the background color of the circle
                    colorCircle.dataset.childImage = product.path; // Store the path of the child image
                    colorCircle.dataset.parentImage = parentElement.querySelector('.parent-img').src; // Store the path of the parent image
                    colorCircle.dataset.parentId = product.parent_id; // Store the parent ID

                    // Add hover effect to change the main image
                    colorCircle.addEventListener('mouseover', function() {
                        let mainImage = parentElement.querySelector('.parent-img');
                        if (mainImage) {
                            mainImage.src = this.dataset.childImage;
                        }
                    });

                    // Add mouseout effect to revert to the parent image
                    colorCircle.addEventListener('mouseout', function() {
                        let mainImage = parentElement.querySelector('.parent-img');
                        if (mainImage) {
                            mainImage.src = this.dataset.parentImage;
                        }
                    });

                    // Ensure color circle container exists
                    if (!colorCircleContainer) {
                        colorCircleContainer = document.createElement('div');
                        colorCircleContainer.classList.add('color-circle-container');
                        parentElement.appendChild(colorCircleContainer);
                    }
                    colorCircleContainer.appendChild(colorCircle);
                }
            }
        });
    }
};




    listProductHTML.addEventListener('click', (event) => {
        let positionClick = event.target;
        if(positionClick.classList.contains('addCart')){
            let id_product = positionClick.parentElement.dataset.id;
            addToCart(id_product);
        }
    })
const addToCart = (product_id) => {
    let positionThisProductInCart = cart.findIndex((value) => value.product_id == product_id);
    if(cart.length <= 0){
        cart = [{
            product_id: product_id,
            quantity: 1
        }];
        body.classList.toggle('showCart');
    }else if(positionThisProductInCart < 0){
        cart.push({
            product_id: product_id,
            quantity: 1
        });
        body.classList.toggle('showCart');
    }else{
        cart[positionThisProductInCart].quantity = cart[positionThisProductInCart].quantity + 1;
        body.classList.toggle('showCart');
    }
    addCartToHTML();
    addCartToMemory();
}
const addCartToMemory = () => {
    localStorage.setItem('cart', JSON.stringify(cart));
}
const addCartToHTML = () => {
    listCartHTML.innerHTML = '';
    let totalQuantity = 0;
    if(cart.length > 0){
        cart.forEach(item => {
            totalQuantity = totalQuantity +  item.quantity;
            let newItem = document.createElement('div');
            newItem.classList.add('item');
            newItem.dataset.id = item.product_id;

            let positionProduct = products.findIndex((value) => value.id == item.product_id);
            let info = products[positionProduct];
            listCartHTML.appendChild(newItem);
            newItem.innerHTML = `
            <div class="image">
                    <img src="${info.path}">
                </div>
                <div class="name">
                ${info.name}
                </div>
                <div class="totalPrice">$${info.price * item.quantity}</div>
                <div class="quantity">
                    <span class="minus"><</span>
                    <span>${item.quantity}</span>
                    <span class="plus">></span>
                </div>
            `;
        })
    }
    iconCartSpan.innerText = totalQuantity;
}

listCartHTML.addEventListener('click', (event) => {
    let positionClick = event.target;
    if(positionClick.classList.contains('minus') || positionClick.classList.contains('plus')){
        let product_id = positionClick.parentElement.parentElement.dataset.id;
        let type = 'minus';
        if(positionClick.classList.contains('plus')){
            type = 'plus';
        }
        changeQuantityCart(product_id, type);
    }
})
const changeQuantityCart = (product_id, type) => {
    let positionItemInCart = cart.findIndex((value) => value.product_id == product_id);
    if(positionItemInCart >= 0){
        let info = cart[positionItemInCart];
        switch (type) {
            case 'plus':
                cart[positionItemInCart].quantity = cart[positionItemInCart].quantity + 1;
                break;
        
            default:
                let changeQuantity = cart[positionItemInCart].quantity - 1;
                if (changeQuantity > 0) {
                    cart[positionItemInCart].quantity = changeQuantity;
                }else{
                    cart.splice(positionItemInCart, 1);
                }
                break;
        }
    }
    addCartToHTML();
    addCartToMemory();
}

const initApp = () => {
    // get data product
    fetch('/api/hats')
    .then(response => response.json())
    .then(data => {
        products = data;
        console.log("*****data:", products)
        addDataToHTML();

        // get data cart from memory
        if(localStorage.getItem('cart')){
            cart = JSON.parse(localStorage.getItem('cart'));
            addCartToHTML();
        }
    })
}
initApp();

