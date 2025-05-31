import React, { useState, useEffect } from "react";

export default function IdentityReconciliationApp() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [identity, setIdentity] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleIdentify(e) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("http://localhost:3000/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phoneNumber: phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to identify");
      setLoading(false);
      return;
    }

    setIdentity(data);
    setContacts([...data.emails.map((e) => ({ type: "email", value: e })), ...data.phoneNumbers.map((p) => ({ type: "phone", value: p }))]);
    setSelectedContact(null);
    setPurchases([]);
    setLoading(false);
  }

  async function fetchPurchases(contact) {
    if (!contact) return;
    setLoading(true);
    const params = new URLSearchParams({
      contactType: contact.type,
      contactValue: contact.value,
    });

    const res = await fetch(`http://localhost:3000/purchases?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to fetch purchases");
      setLoading(false);
      return;
    }

    setPurchases(data.purchases);
    setSelectedContact(contact);
    setLoading(false);
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Identity Reconciliation</h1>

      {/* Identify form */}
      <form onSubmit={handleIdentify} className="mb-6 flex gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 rounded hover:bg-blue-700"
          disabled={loading || (!email && !phone)}
        >
          {loading ? "Loading..." : "Identify"}
        </button>
      </form>

      {/* Identity info */}
      {identity && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h2 className="text-xl font-semibold mb-2">Unified Identity</h2>
          <p><strong>Primary Contact ID:</strong> {identity.primaryContactId}</p>
          <p><strong>Emails:</strong> {identity.emails.join(", ") || "None"}</p>
          <p><strong>Phone Numbers:</strong> {identity.phoneNumbers.join(", ") || "None"}</p>
          <p><strong>Secondary Contact IDs:</strong> {identity.secondaryContactIds.join(", ") || "None"}</p>
        </div>
      )}

      {/* Contacts list */}
      {contacts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Contacts linked to this identity</h3>
          <ul className="border rounded divide-y">
            {contacts.map((contact, i) => (
              <li
                key={`${contact.type}-${contact.value}`}
                className={`p-3 cursor-pointer hover:bg-gray-100 ${
                  selectedContact?.value === contact.value ? "bg-blue-100" : ""
                }`}
                onClick={() => fetchPurchases(contact)}
              >
                <span className="font-semibold">{contact.type.toUpperCase()}</span>: {contact.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Purchases list */}
      {selectedContact && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Purchases for {selectedContact.value}</h3>
          {purchases.length === 0 ? (
            <p>No purchases found.</p>
          ) : (
            <ul className="border rounded divide-y">
              {purchases.map((purchase, i) => (
                <li key={i} className="p-3">
                  <p><strong>{purchase.item}</strong></p>
                  <p>Amount: ${purchase.amount.toFixed(2)}</p>
                  <p>Date: {new Date(purchase.purchase_date).toLocaleDateString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
