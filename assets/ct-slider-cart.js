// assets/ct-slider-cart.js

(function () {
  "use strict";

  // ===== 1. INTERCEPT ADD TO CART BUTTON CLICKS =====

  document.addEventListener(
    "click",
    function (e) {
      const button = e.target.closest("button");

      if (!button) {
        return;
      }

      // Check multiple selectors (different themes use different classes)
      const isAddToCart =
        button.classList.contains("add-to-cart") ||
        button.classList.contains("product-form__submit") ||
        button.classList.contains("product-form__submit-button") ||
        button.id === "AddToCart" ||
        button.getAttribute("data-action") === "add-to-cart" ||
        button.textContent.toLowerCase().includes("add to cart") ||
        button.textContent.toLowerCase().includes("add to bag") ||
        button.textContent.toLowerCase().includes("buy now");

      if (!isAddToCart) {
        return;
      }

      handleAddToCart(button);
    },
    true
  );

  // ===== 2. HANDLE ADD TO CART =====

  async function handleAddToCart(button) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Adding...";

    try {
      // Find and submit the form
      const form = button.closest("form");

      if (form) {
        const formData = new FormData(form);

        // Submit to Shopify's cart endpoint
        const addToCartResponse = await fetch("/cart/add.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: [
              {
                id: formData.get("id"),
                quantity: parseInt(formData.get("quantity")) || 1,
                properties: {},
              },
            ],
          }),
        });

        if (!addToCartResponse.ok) {
          console.error(
            "Error adding to cart. Status:",
            addToCartResponse.status
          );
        }
      }

      // Wait for Shopify to process
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Fetch cart from Shopify
      const cart = await fetchShopifyCart();

      // Render items
      renderCartItems(cart.items);
      updateCartTotals(cart);

      // Open slider
      openCartSlider();
    } catch (error) {
      console.error("Error handling add to cart:", error);
      alert("Error adding item to cart. Please try again.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  // ===== 3. FETCH CART FROM SHOPIFY =====

  async function fetchShopifyCart() {
    try {
      const response = await fetch("/cart.js", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch cart. Status: " + response.status);
      }

      const cart = await response.json();
      return cart;
    } catch (error) {
      console.error("Error fetching cart:", error);
      throw error;
    }
  }

  // ===== 4. RENDER CART ITEMS =====

  function renderCartItems(items) {
    const container = document.getElementById("cartItems");

    if (!container) {
      console.error("cartItems container not found!");
      return;
    }

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-cart">
          <div class="empty-cart-icon">🛍️</div>
          <p>Your cart is empty</p>
        </div>
      `;
      return;
    }

    // Build HTML for each item - use index as line number
    const itemsHTML = items
      .map((item, index) => {
        const itemTotal = (item.price * item.quantity) / 100; // Convert cents to dollars
        const lineNumber = index + 1; // Shopify uses 1-based line numbers

        // Build properties HTML
        let propertiesHTML = "";

        // Add variant options with proper labels
        if (item.options_with_values && item.options_with_values.length > 0) {
          item.options_with_values.forEach((option) => {
            propertiesHTML += `<span class="property"><strong>${option.name}:</strong> ${option.value}</span>`;
          });
        } else {
        }

        // Add custom properties if exist
        if (item.properties && Object.keys(item.properties).length > 0) {
          Object.entries(item.properties).forEach(([key, value]) => {
            if (value) {
              propertiesHTML += `<span class="property">${key}: ${value}</span>`;
            }
          });
        }

        return `
        <div class="cart-item" data-item-line="${lineNumber}" data-item-key="${
          item.key
        }">
          <div class="item-header">
            <h4>${item.title}</h4>
            <button class="remove-btn" data-item-line="${lineNumber}" type="button" title="Remove">×</button>
          </div>
          
          ${
            propertiesHTML
              ? `<div class="item-properties">${propertiesHTML}</div>`
              : ""
          }
          
          <div class="item-footer">
            <div class="quantity-control">
              <button class="qty-btn qty-minus" data-item-line="${lineNumber}" type="button">−</button>
              <input type="number" class="qty-input" value="${
                item.quantity
              }" readonly>
              <button class="qty-btn qty-plus" data-item-line="${lineNumber}" type="button">+</button>
            </div>
            <span class="item-price">${itemTotal.toFixed(2)}</span>
          </div>
        </div>
      `;
      })
      .join("");

    container.innerHTML = itemsHTML;

    // Attach event listeners to new elements
    attachCartItemListeners();
  }

  // ===== 5. UPDATE CART TOTALS =====

  function updateCartTotals(cart) {
    // Shopify returns prices in cents
    const subtotal = cart.total_price / 100 - (cart.total_tax || 0) / 100;
    const tax = (cart.total_tax || 0) / 100;
    const total = cart.total_price / 100;

    const subtotalEl = document.getElementById("subtotal");
    const taxEl = document.getElementById("tax");
    const totalEl = document.getElementById("total");

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
  }

  // ===== 6. ATTACH CART ITEM LISTENERS =====

  function attachCartItemListeners() {
    // Remove button
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const lineNumber = btn.getAttribute("data-item-line");
        await removeFromCart(lineNumber);
      });
    });

    // Quantity plus button
    document.querySelectorAll(".qty-plus").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const lineNumber = btn.getAttribute("data-item-line");
        const currentQty = parseInt(
          btn.parentElement.querySelector(".qty-input").value
        );
        await updateCartItemQuantity(lineNumber, currentQty + 1);
      });
    });

    // Quantity minus button
    document.querySelectorAll(".qty-minus").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const lineNumber = btn.getAttribute("data-item-line");
        const currentQty = parseInt(
          btn.parentElement.querySelector(".qty-input").value
        );
        if (currentQty > 1) {
          await updateCartItemQuantity(lineNumber, currentQty - 1);
        }
      });
    });
  }

  // ===== 7. UPDATE ITEM QUANTITY =====

  async function updateCartItemQuantity(lineNumber, newQuantity) {
    try {
      console.log("Updating quantity - line:", lineNumber, "qty:", newQuantity);

      // Use FormData to send data in correct format for Shopify
      const formData = new FormData();
      formData.append("line", lineNumber);
      formData.append("quantity", newQuantity);

      const response = await fetch("/cart/change.js", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(
          "Failed to update quantity. Status: " + response.status
        );
      }

      const cart = await response.json();
      renderCartItems(cart.items);
      updateCartTotals(cart);
    } catch (error) {
      console.error("Error updating quantity:", error);
      // Fetch fresh cart anyway
      const cart = await fetchShopifyCart();
      renderCartItems(cart.items);
      updateCartTotals(cart);
    }
  }

  // ===== 8. REMOVE ITEM FROM CART =====

  async function removeFromCart(lineNumber) {
    try {
      console.log("Removing item - line:", lineNumber);

      // Use FormData to send data in correct format for Shopify
      const formData = new FormData();
      formData.append("line", lineNumber);
      formData.append("quantity", 0);

      const response = await fetch("/cart/change.js", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error("Failed to remove item. Status: " + response.status);
      }

      const cart = await response.json();
      renderCartItems(cart.items);
      updateCartTotals(cart);
    } catch (error) {
      console.error("Error removing item:", error);
      // Fetch fresh cart anyway
      const cart = await fetchShopifyCart();
      renderCartItems(cart.items);
      updateCartTotals(cart);
    }
  }

  // ===== 9. OPEN/CLOSE SLIDER =====

  function openCartSlider() {
    const slider = document.getElementById("sliderCart");
    const overlay = document.getElementById("cartOverlay");

    if (slider) slider.classList.add("open");
    if (overlay) overlay.classList.add("open");
  }

  function closeCartSlider() {
    const slider = document.getElementById("sliderCart");
    const overlay = document.getElementById("cartOverlay");

    if (slider) slider.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
  }

  // Close button click
  const closeBtn = document.getElementById("closeBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeCartSlider);
  }

  // Overlay click
  const overlay = document.getElementById("cartOverlay");
  if (overlay) {
    overlay.addEventListener("click", closeCartSlider);
  }

  // ===== 10. HANDLE CHECKOUT =====

  const checkoutBtn = document.querySelector(".checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", function (e) {
      const notes = document.getElementById("orderNotes").value;
      if (notes) {
        localStorage.setItem("cartNotes", notes);
      }
    });
  }

  // ===== 11. AUTO-SAVE ORDER NOTES =====

  let notesTimeout;
  const notesTextarea = document.getElementById("orderNotes");

  if (notesTextarea) {
    notesTextarea.addEventListener("input", (e) => {
      clearTimeout(notesTimeout);

      notesTimeout = setTimeout(() => {
        const notes = e.target.value;
        localStorage.setItem("cartNotes", notes);
      }, 1000);
    });
  }

  // ===== 12. LOAD SAVED NOTES ON PAGE LOAD =====

  window.addEventListener("load", () => {
    const savedNotes = localStorage.getItem("cartNotes");
    if (savedNotes) {
      const notesTextarea = document.getElementById("orderNotes");
      if (notesTextarea) {
        notesTextarea.value = savedNotes;
      }
    }

    // Also load cart on page load
    fetchShopifyCart()
      .then((cart) => {
        if (cart.items && cart.items.length > 0) {
          renderCartItems(cart.items);
          updateCartTotals(cart);
        }
      })
      .catch((err) => console.error("Failed to load cart on page load:", err));
  });
})();
