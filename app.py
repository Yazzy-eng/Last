"""
app.py
------
Backend-ka Flask ee Deeqsan Store.

Wuxuu sameeyaa laba shaqo:
  1) Adeega API-ga (/api/...) — ku shaqeeya database-ka SQLite.
  2) Bixinta frontend-ka (HTML/CSS/JS) ee galka 'frontend/'.

Si aad u ordiso:   python app.py
Kadibna fur:        http://127.0.0.1:5000
"""

from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
import json
import os

import database as db

app = Flask(__name__, static_folder=None)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

# Samee database-ka marka kowaad la furo serfara.
db.init_db()


# ─────────────────────────────────────────────────────────────
# Caawiye taariikheed — sida kii frontend-ka asalka ahaa
# ─────────────────────────────────────────────────────────────
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def date_parts():
    d = datetime.now()
    date_key = d.strftime("%Y-%m-%d")
    month_key = d.strftime("%Y-%m")
    date_label = f"{d.day} {MONTHS[d.month - 1]} {d.year}"
    return date_label, date_key, month_key


# ═════════════════════════════════════════════════════════════
#  FRONTEND  (HTML / CSS / JS)
# ═════════════════════════════════════════════════════════════
@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


# ═════════════════════════════════════════════════════════════
#  API: LOGIN
# ═════════════════════════════════════════════════════════════
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    user = data.get("user")
    password = data.get("password")

    conn = db.get_db()
    row = conn.execute("SELECT * FROM users WHERE name = ?", (user,)).fetchone()
    conn.close()

    if row is None or row["password"] != password:
        return jsonify({"ok": False, "error": "Fure khaldan!"}), 401

    return jsonify({
        "ok": True,
        "user": row["name"],
        "displayName": row["display_name"],
        "role": row["role"],
    })


# ═════════════════════════════════════════════════════════════
#  API: USERS  (loo isticmaalo beddelka password-ka)
# ═════════════════════════════════════════════════════════════
@app.route("/api/users", methods=["GET"])
def get_users():
    conn = db.get_db()
    rows = conn.execute("SELECT name, display_name FROM users").fetchall()
    conn.close()
    return jsonify([{"name": r["name"], "displayName": r["display_name"]} for r in rows])


@app.route("/api/users/<name>/password", methods=["PUT"])
def update_password(name):
    data = request.get_json(force=True)
    new_pass = (data.get("password") or "").strip()
    if not new_pass:
        return jsonify({"ok": False, "error": "Fadlan qor password!"}), 400

    conn = db.get_db()
    conn.execute("UPDATE users SET password = ? WHERE name = ?", (new_pass, name))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ═════════════════════════════════════════════════════════════
#  API: PRODUCTS (Alaabta)
# ═════════════════════════════════════════════════════════════
@app.route("/api/products", methods=["GET"])
def list_products():
    conn = db.get_db()
    rows = conn.execute("SELECT * FROM products ORDER BY id").fetchall()
    conn.close()
    return jsonify([db.product_to_dict(r) for r in rows])


@app.route("/api/products", methods=["POST"])
def add_product():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    price = data.get("priceUSD")
    if not name or price is None:
        return jsonify({"error": "Fadlan geli magaca iyo qiimaha!"}), 400

    conn = db.get_db()
    cur = conn.execute(
        "INSERT INTO products (name, price_usd) VALUES (?, ?)", (name, float(price))
    )
    conn.commit()
    new_id = cur.lastrowid
    row = conn.execute("SELECT * FROM products WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return jsonify(db.product_to_dict(row)), 201


@app.route("/api/products/<int:pid>", methods=["DELETE"])
def delete_product(pid):
    conn = db.get_db()
    conn.execute("DELETE FROM products WHERE id = ?", (pid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ═════════════════════════════════════════════════════════════
#  API: CUSTOMERS (Macaamiisha)
# ═════════════════════════════════════════════════════════════
@app.route("/api/customers", methods=["GET"])
def list_customers():
    conn = db.get_db()
    rows = conn.execute("SELECT * FROM customers ORDER BY id").fetchall()
    conn.close()
    return jsonify([db.customer_to_dict(r) for r in rows])


@app.route("/api/customers", methods=["POST"])
def add_customer():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    address = (data.get("address") or "").strip()
    ctype = data.get("type") or "Monthly"
    if not name or not phone:
        return jsonify({"error": "Fadlan geli Magaca iyo Telefoonka!"}), 400

    conn = db.get_db()
    cur = conn.execute(
        "INSERT INTO customers (name, phone, address, type) VALUES (?, ?, ?, ?)",
        (name, phone, address, ctype),
    )
    conn.commit()
    new_id = cur.lastrowid
    row = conn.execute("SELECT * FROM customers WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return jsonify(db.customer_to_dict(row)), 201


@app.route("/api/customers/<int:cid>", methods=["DELETE"])
def delete_customer(cid):
    conn = db.get_db()
    conn.execute("DELETE FROM customers WHERE id = ?", (cid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ═════════════════════════════════════════════════════════════
#  API: SALES (Iibka)
# ═════════════════════════════════════════════════════════════
@app.route("/api/sales", methods=["GET"])
def list_sales():
    conn = db.get_db()
    rows = conn.execute("SELECT * FROM sales ORDER BY id").fetchall()
    conn.close()
    return jsonify([db.sale_to_dict(r) for r in rows])


@app.route("/api/sales", methods=["POST"])
def add_sale():
    data = request.get_json(force=True)
    items = data.get("items") or []
    if not items:
        return jsonify({"error": "Dambiishu waa maran tahay!"}), 400

    date_label, date_key, month_key = date_parts()

    conn = db.get_db()
    cur = conn.execute(
        """INSERT INTO sales
           (date_label, date_key, month_key, cashier, customer_type, customer_id,
            status, payment_method, is_manual_credit, credit_amount_usd, credit_note, items)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?)""",
        (
            date_label, date_key, month_key,
            data.get("cashier"),
            data.get("customerType"),
            data.get("customerId"),
            data.get("status"),
            data.get("paymentMethod"),
            json.dumps(items),
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    row = conn.execute("SELECT * FROM sales WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return jsonify(db.sale_to_dict(row)), 201


# ═════════════════════════════════════════════════════════════
#  API: PAYMENTS (Lacag deyn laga gooyo — manual credit)
# ═════════════════════════════════════════════════════════════
@app.route("/api/payments", methods=["POST"])
def add_payment():
    data = request.get_json(force=True)
    amount_usd = data.get("amountUSD")
    note = data.get("note") or ""
    if amount_usd is None or float(amount_usd) <= 0:
        return jsonify({"error": "Fadlan qor lacag sax ah."}), 400

    date_label, date_key, month_key = date_parts()
    items = [{"product": {"name": f"Lacag la helay ({note})", "priceUSD": 0}, "qty": 1}]

    conn = db.get_db()
    cur = conn.execute(
        """INSERT INTO sales
           (date_label, date_key, month_key, cashier, customer_type, customer_id,
            status, payment_method, is_manual_credit, credit_amount_usd, credit_note, items)
           VALUES (?, ?, ?, ?, 'Monthly', ?, 'paid', ?, 1, ?, ?, ?)""",
        (
            date_label, date_key, month_key,
            data.get("cashier"),
            data.get("customerId"),
            data.get("currency"),
            float(amount_usd),
            note,
            json.dumps(items),
        ),
    )
    conn.commit()
    new_id = cur.lastrowid
    row = conn.execute("SELECT * FROM sales WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return jsonify(db.sale_to_dict(row)), 201


# ═════════════════════════════════════════════════════════════
#  API: SETTINGS (Sarrifka lacagta)
# ═════════════════════════════════════════════════════════════
@app.route("/api/settings", methods=["GET"])
def get_settings():
    conn = db.get_db()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    return jsonify({r["key"]: r["value"] for r in rows})


@app.route("/api/settings", methods=["PUT"])
def update_settings():
    data = request.get_json(force=True)
    conn = db.get_db()
    for key, value in data.items():
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value)),
        )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
