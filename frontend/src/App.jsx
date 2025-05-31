import React, { useState } from "react";

const products = [
  {
    id: 1,
    name: "Wireless Headphones",
    price: 49.99,
    image: "https://via.placeholder.com/150?text=Headphones",
  },
  {
    id: 2,
    name: "Smartphone",
    price: 299.99,
    image: "https://via.placeholder.com/150?text=Smartphone",
  },
  {
    id: 3,
    name: "Smart Watch",
    price: 99.99,
    image: "https://via.placeholder.com/150?text=Smart+Watch",
  },
];

export default function App() {
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [identity, setIdentity] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function identifyUser() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:3000/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Identification failed");
      setIdentity(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function addToCart(product) {
    if (!identity) {
      alert("Please identify yourself first.");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      } else {
        return [...prev, { ...product, qty: 1 }];
      }
    });
  }

  function removeFromCart(productId) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId ? { ...item, qty: item.qty - 1 } : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  async function checkout() {
    if (!identity) return alert("Identify before checkout");
    if (cart.length === 0) return alert("Cart is empty");

    setLoading(true);
    setError("");
    try {
      for (const item of cart) {
        await fetch("http://localhost:3000/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactType: "customer_id",
            contactValue: identity.primaryContactId.toString(),
            item: item.name,
            amount: item.price * item.qty,
          }),
        });
      }
      alert("Checkout successful!");
      setCart([]);
    } catch (err) {
      setError("Checkout failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col md:flex-row">
      {/* Left - Product Area */}
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold mb-4">FluxKart</h1>

        {/* Identify Form */}
        <div className="bg-white p-4 rounded shadow mb-6">
          <h2 className="text-xl font-semibold mb-2">Identify Yourself</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input
              className="border p-2 rounded w-full"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="border p-2 rounded w-full"
              placeholder="Phone Number (optional)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <button
              onClick={identifyUser}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              disabled={loading}
            >
              {loading ? "Identifying..." : "Identify"}
            </button>
          </div>
          {identity && (
            <div className="mt-3 text-sm text-green-700">
              Identified as Customer ID: {identity.primaryContactId}
            </div>
          )}
          {error && <p className="text-red-600 mt-2">{error}</p>}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="border rounded-lg p-4 bg-white shadow hover:shadow-lg transition"
            >
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-40 object-cover mb-4 rounded"
              />
              <h2 className="text-xl font-semibold">{product.name}</h2>
              <p className="text-gray-700 mb-4">${product.price.toFixed(2)}</p>
              <button
                onClick={() => addToCart(product)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Right - Cart Sidebar */}
      <aside className="w-full md:w-80 bg-white border-l p-6">
        <h2 className="text-2xl font-bold mb-4">Your Cart</h2>
        {cart.length === 0 ? (
          <p className="text-gray-500">Cart is empty.</p>
        ) : (
          <ul>
            {cart.map((item) => (
              <li
                key={item.id}
                className="flex justify-between items-center mb-3 border-b pb-2"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-600">
                    ${item.price.toFixed(2)} × {item.qty}
                  </p>
                </div>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-red-600 hover:text-red-800 font-bold text-xl leading-none"
                  aria-label={`Remove one ${item.name} from cart`}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 font-semibold text-lg">
          Total: ${totalPrice.toFixed(2)}
        </div>
        <button
          onClick={checkout}
          className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
          disabled={cart.length === 0 || !identity || loading}
        >
          {loading ? "Processing..." : "Checkout"}
        </button>
      </aside>
    </div>
  );
}
