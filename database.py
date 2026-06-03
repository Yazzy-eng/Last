"""
database.py
-----------
Maamulka database-ka SQLite (simple, file-based).
Halkan waxaa lagu sameeyaa schema-ga iyo xogta bilowga (seed data).

Database-ka waa hal fayl: deeqsan.db
Maaha loo baahna server gaar ah — SQLite waa mid fudud oo ku jira Python.
"""

import sqlite3
import json
import os

# Faylka database-ka — wuxuu si toos ah u abuurmaa marka kowaad la furo.
DB_PATH = os.path.join(os.path.dirname(__file__), "deeqsan.db")


def get_db():
    """Fur xiriir cusub oo database ah. row_factory => natiijooyinka dict ahaan."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Samee miisaska (tables) haddii aanay jirin, kana dhig seed xogta bilowga."""
    conn = get_db()
    cur = conn.cursor()

    # ── Miisaska (Tables) ──
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            name         TEXT PRIMARY KEY,   -- tusaale: "Manager", "Cashier 1"
            display_name TEXT,               -- magaca la tuso: "Manager (Rooda)"
            password     TEXT NOT NULL,
            role         TEXT NOT NULL        -- 'manager' ama 'cashier'
        );

        CREATE TABLE IF NOT EXISTS products (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT NOT NULL,
            price_usd REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS customers (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name    TEXT NOT NULL,
            phone   TEXT,
            address TEXT,
            type    TEXT NOT NULL            -- 'Monthly' (Bille) ama 'Daily' (Maalinle)
        );

        CREATE TABLE IF NOT EXISTS sales (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            date_label       TEXT,           -- "1 Jun 2026"
            date_key         TEXT,           -- "2026-06-01"
            month_key        TEXT,           -- "2026-06"
            cashier          TEXT,
            customer_type    TEXT,
            customer_id      INTEGER,
            status           TEXT,           -- 'paid' ama 'tab'
            payment_method   TEXT,           -- 'Zaad', 'eDahab', 'Cash', 'USD', 'SlSh'
            is_manual_credit INTEGER DEFAULT 0,
            credit_amount_usd REAL DEFAULT 0,
            credit_note      TEXT,
            items            TEXT            -- JSON: liiska alaabta
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
        """
    )
    conn.commit()

    # ── Seed: Isticmaaleyaasha (kaliya haddii faaruq tahay) ──
    if cur.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"] == 0:
        users = [
            ("Manager",   "Manager (Rooda)",  "admin123", "manager"),
            ("Cashier 1", "Cashier 1 Yasin",  "1234",     "cashier"),
            ("Cashier 2", "Cashier Hamda",    "1234",     "cashier"),
            ("Cashier 3", "Cashier 3 Marwa",  "1234",     "cashier"),
            ("Cashier 4", "Cashier 4 Sakiya", "1234",     "cashier"),
        ]
        cur.executemany(
            "INSERT INTO users (name, display_name, password, role) VALUES (?, ?, ?, ?)",
            users,
        )

    # ── Seed: Alaabta (Products) ──
    if cur.execute("SELECT COUNT(*) AS c FROM products").fetchone()["c"] == 0:
        products = [
            ("Bariis 5kg", 8.00),
            ("Sonkor 2kg", 3.50),
            ("Saliid Cade 1L", 7.00),
            ("Baasto 2kg", 5.00),
            ("Sonkor 5kg", 8.75),
        ]
        cur.executemany(
            "INSERT INTO products (name, price_usd) VALUES (?, ?)", products
        )

    # ── Seed: Macaamiisha (Customers) ──
    if cur.execute("SELECT COUNT(*) AS c FROM customers").fetchone()["c"] == 0:
        customers = [
            ("Amina Hassan", "+252 61 234 5678", "Jigjiga Yar, Hargeisa", "Monthly"),
            ("Mohamed Jama", "+252 63 998 7654", "26 June, Hargeisa", "Monthly"),
            ("Macmiil Maalinle", "—", "Hargeisa", "Daily"),
        ]
        cur.executemany(
            "INSERT INTO customers (name, phone, address, type) VALUES (?, ?, ?, ?)",
            customers,
        )

    # ── Seed: Settings (sarrifka lacagta) ──
    if cur.execute("SELECT COUNT(*) AS c FROM settings").fetchone()["c"] == 0:
        cur.execute(
            "INSERT INTO settings (key, value) VALUES ('exchange_rate', '8500')"
        )

    conn.commit()
    conn.close()


# ─────────────────────────────────────────────────────────────
# Hawlaha caawinta (helpers) — qaab dict ah oo frontend-ku fahmi karo
# ─────────────────────────────────────────────────────────────

def product_to_dict(row):
    return {"id": row["id"], "name": row["name"], "priceUSD": row["price_usd"]}


def customer_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "phone": row["phone"],
        "address": row["address"],
        "type": row["type"],
    }


def sale_to_dict(row):
    return {
        "id": row["id"],
        "date": row["date_label"],
        "dateKey": row["date_key"],
        "monthKey": row["month_key"],
        "cashier": row["cashier"],
        "customerType": row["customer_type"],
        "customerId": row["customer_id"],
        "status": row["status"],
        "paymentMethod": row["payment_method"],
        "isManualCredit": bool(row["is_manual_credit"]),
        "creditAmountUSD": row["credit_amount_usd"],
        "creditNote": row["credit_note"],
        "items": json.loads(row["items"]) if row["items"] else [],
    }


if __name__ == "__main__":
    # Ku orod si toos ah si aad u abuurto/u dib u dejiso database-ka.
    init_db()
    print(f"✅ Database diyaar: {DB_PATH}")
