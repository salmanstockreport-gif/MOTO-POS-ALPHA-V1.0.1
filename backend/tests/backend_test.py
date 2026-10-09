"""Backend regression tests for MotoPOS."""
import os
import time
import uuid
import threading
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend env
    try:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "ncsasar@gmail.com"
ADMIN_PASSWORD = "Admin@123"

TAG = f"TEST_{uuid.uuid4().hex[:6].upper()}"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def original_settings(admin):
    r = admin.get(f"{API}/settings")
    assert r.status_code == 200
    return r.json()


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WrongPass!"}, timeout=20)
        assert r.status_code in (401, 429)

    def test_me(self, admin):
        r = admin.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL
        assert r.json()["role"] == "admin"


# ---------------- Items search tokenized ----------------
class TestItemSearch:
    created_ids = []

    @pytest.fixture(scope="class", autouse=True)
    def seed(self, admin, request):
        # Create test items with distinctive tokens
        items = [
            {"part_no": f"{TAG}-BRK-PUL150", "name": "Brake Pad Front", "brand": "TESTBRAND", "category": "Brakes",
             "fitments": ["Bajaj Pulsar 150"], "hsn_code": "8714", "gst_rate": 18, "mrp": 500, "sale_price": 500,
             "purchase_price": 300, "stock": 100, "min_stock": 5, "unit": "PCS", "location": "A1"},
            {"part_no": f"{TAG}-BRK-SPL", "name": "Brake Shoe Rear", "brand": "TESTBRAND", "category": "Brakes",
             "fitments": ["Hero Splendor"], "hsn_code": "8714", "gst_rate": 18, "mrp": 300, "sale_price": 300,
             "purchase_price": 200, "stock": 50, "min_stock": 5, "unit": "PCS", "location": "B2"},
            {"part_no": f"{TAG}-OIL-20W", "name": "Engine Oil", "brand": "TESTOIL", "category": "Lubricants",
             "fitments": ["Universal"], "hsn_code": "2710", "gst_rate": 18, "mrp": 450, "sale_price": 450,
             "purchase_price": 300, "stock": 30, "min_stock": 10, "unit": "LTR", "location": "C3"},
        ]
        for it in items:
            r = admin.post(f"{API}/items", json=it)
            assert r.status_code == 200, r.text
            TestItemSearch.created_ids.append(r.json()["id"])

        def cleanup():
            for iid in TestItemSearch.created_ids:
                admin.delete(f"{API}/items/{iid}")
        request.addfinalizer(cleanup)

    def test_tokenized_search_all_match(self, admin):
        # "brake pulsar 150" -> every token should match somewhere
        r = admin.get(f"{API}/items", params={"q": f"brake pulsar 150", "limit": 50})
        assert r.status_code == 200
        parts = [i["part_no"] for i in r.json()["items"]]
        assert f"{TAG}-BRK-PUL150" in parts
        assert f"{TAG}-BRK-SPL" not in parts  # does not match "pulsar"/"150"

    def test_search_brand(self, admin):
        r = admin.get(f"{API}/items", params={"q": "TESTBRAND brake"})
        parts = [i["part_no"] for i in r.json()["items"]]
        assert f"{TAG}-BRK-PUL150" in parts and f"{TAG}-BRK-SPL" in parts
        assert f"{TAG}-OIL-20W" not in parts

    def test_search_location(self, admin):
        r = admin.get(f"{API}/items", params={"q": "A1"})
        parts = [i["part_no"] for i in r.json()["items"]]
        assert f"{TAG}-BRK-PUL150" in parts

    def test_search_hsn(self, admin):
        r = admin.get(f"{API}/items", params={"q": "2710 oil"})
        parts = [i["part_no"] for i in r.json()["items"]]
        assert f"{TAG}-OIL-20W" in parts

    def test_search_no_match(self, admin):
        r = admin.get(f"{API}/items", params={"q": "zzzzz nothinghere"})
        assert r.json()["total"] == 0


# ---------------- Settings ----------------
class TestSettings:
    def test_get_settings(self, admin):
        r = admin.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert "invoice_prefix" in d
        assert "allow_negative_stock" in d

    def test_update_settings_persists(self, admin, original_settings, request):
        body = {**original_settings, "footer_note": f"{TAG}-footer"}
        body.pop("id", None); body.pop("_id", None)
        r = admin.put(f"{API}/settings", json=body)
        assert r.status_code == 200
        assert r.json()["footer_note"] == f"{TAG}-footer"

        def restore():
            restore_body = {**original_settings}
            restore_body.pop("id", None); restore_body.pop("_id", None)
            admin.put(f"{API}/settings", json=restore_body)
        request.addfinalizer(restore)


# ---------------- Invoice: walk-in, credit, insufficient stock, concurrency ----------------
class TestInvoices:
    @pytest.fixture(scope="class")
    def test_item(self, admin, request):
        pn = f"{TAG}-INVITEM"
        r = admin.post(f"{API}/items", json={
            "part_no": pn, "name": "Test Invoice Item", "brand": "TB", "category": "Test",
            "fitments": [], "hsn_code": "8714", "gst_rate": 18, "mrp": 100, "sale_price": 100,
            "purchase_price": 50, "stock": 1000, "min_stock": 5, "unit": "PCS", "location": "X1",
        })
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        request.addfinalizer(lambda: admin.delete(f"{API}/items/{iid}"))
        return r.json()

    @pytest.fixture(scope="class")
    def test_customer(self, admin, request):
        r = admin.post(f"{API}/customers", json={
            "name": f"{TAG}_Customer", "phone": f"9{uuid.uuid4().int % 1000000000:09d}",
            "email": "", "gstin": "", "address": "", "state": "Maharashtra", "opening_balance": 0,
        })
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        request.addfinalizer(lambda: admin.delete(f"{API}/customers/{cid}"))
        return r.json()

    def test_walkin_paid_invoice(self, admin, test_item):
        # Get stock before
        iid = test_item["id"]
        s_before = admin.get(f"{API}/items/{iid}").json()["stock"]
        payload = {
            "customer_id": None, "customer_name": "Walk-in", "lines": [
                {"item_id": iid, "qty": 2, "rate": 100, "discount": 0}
            ],
            "payments": [{"mode": "cash", "amount": 200}],
            "bill_discount": 0,
        }
        r = admin.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["payment_status"] == "paid"
        assert inv["number"].count("/") == 2
        # stock decrement
        s_after = admin.get(f"{API}/items/{iid}").json()["stock"]
        assert s_after == s_before - 2

    def test_credit_without_customer_fails(self, admin, test_item):
        iid = test_item["id"]
        r = admin.post(f"{API}/invoices", json={
            "customer_id": None, "customer_name": "Walk-in", "lines": [
                {"item_id": iid, "qty": 1, "rate": 100, "discount": 0}
            ], "payments": [], "bill_discount": 0,
        })
        assert r.status_code == 400
        assert "customer" in r.text.lower()

    def test_credit_partial_payment_ledger(self, admin, test_item, test_customer):
        iid = test_item["id"]
        cid = test_customer["id"]
        bal_before = admin.get(f"{API}/customers/{cid}").json().get("balance", 0)
        r = admin.post(f"{API}/invoices", json={
            "customer_id": cid, "lines": [{"item_id": iid, "qty": 1, "rate": 100, "discount": 0}],
            "payments": [{"mode": "cash", "amount": 40}], "bill_discount": 0,
        })
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["payment_status"] == "partial"
        assert inv["due"] > 0
        bal_after = admin.get(f"{API}/customers/{cid}").json()["balance"]
        # bal increase == due
        assert round(bal_after - bal_before, 2) == round(inv["due"], 2)
        # ledger has invoice + payment
        led = admin.get(f"{API}/customers/{cid}/ledger").json()
        assert any(e["type"] == "invoice" and e["ref"] == inv["number"] for e in led)
        assert any(e["type"] == "payment" and e["ref"] == inv["number"] for e in led)

    def test_insufficient_stock_409(self, admin, test_item, original_settings):
        # Make sure negative stock not allowed; restore afterwards
        if original_settings.get("allow_negative_stock"):
            body = {**original_settings, "allow_negative_stock": False}
            body.pop("id", None); body.pop("_id", None)
            admin.put(f"{API}/settings", json=body)
            try:
                self._do_insufficient_test(admin, test_item)
            finally:
                restore = {**original_settings}
                restore.pop("id", None); restore.pop("_id", None)
                admin.put(f"{API}/settings", json=restore)
        else:
            self._do_insufficient_test(admin, test_item)

    def _do_insufficient_test(self, admin, test_item):
        iid = test_item["id"]
        s = admin.get(f"{API}/items/{iid}").json()["stock"]
        r = admin.post(f"{API}/invoices", json={
            "customer_id": None, "customer_name": "WI",
            "lines": [{"item_id": iid, "qty": s + 100000, "rate": 100, "discount": 0}],
            "payments": [{"mode": "cash", "amount": (s + 100000) * 100}], "bill_discount": 0,
        })
        assert r.status_code == 409, r.text

    def test_concurrent_invoice_unique_numbers_and_stock(self, admin, test_item):
        iid = test_item["id"]
        s_before = admin.get(f"{API}/items/{iid}").json()["stock"]
        n = 10
        results = [None] * n
        token = admin.headers["Authorization"]

        def fire(i):
            try:
                r = requests.post(f"{API}/invoices", headers={"Authorization": token, "Content-Type": "application/json"},
                                  json={"customer_id": None, "customer_name": "WI",
                                        "lines": [{"item_id": iid, "qty": 1, "rate": 100, "discount": 0}],
                                        "payments": [{"mode": "cash", "amount": 100}],
                                        "bill_discount": 0}, timeout=30)
                results[i] = r
            except Exception as e:
                results[i] = e

        threads = [threading.Thread(target=fire, args=(i,)) for i in range(n)]
        for t in threads: t.start()
        for t in threads: t.join()

        oks = [r for r in results if hasattr(r, "status_code") and r.status_code == 200]
        assert len(oks) == n, f"Only {len(oks)}/{n} succeeded: {[getattr(r,'text',str(r))[:80] for r in results]}"
        numbers = [r.json()["number"] for r in oks]
        assert len(set(numbers)) == n, f"Duplicate numbers: {numbers}"
        s_after = admin.get(f"{API}/items/{iid}").json()["stock"]
        assert s_before - s_after == n

    def test_cancel_invoice_reverses_stock(self, admin, test_item):
        iid = test_item["id"]
        s_before = admin.get(f"{API}/items/{iid}").json()["stock"]
        r = admin.post(f"{API}/invoices", json={
            "customer_id": None, "customer_name": "WI",
            "lines": [{"item_id": iid, "qty": 3, "rate": 100, "discount": 0}],
            "payments": [{"mode": "cash", "amount": 300}], "bill_discount": 0,
        })
        assert r.status_code == 200
        inv_id = r.json()["id"]
        s_mid = admin.get(f"{API}/items/{iid}").json()["stock"]
        assert s_mid == s_before - 3
        c = admin.post(f"{API}/invoices/{inv_id}/cancel")
        assert c.status_code == 200
        s_after = admin.get(f"{API}/items/{iid}").json()["stock"]
        assert s_after == s_before


# ---------------- Next invoice number ----------------
class TestInvoiceNumber:
    def test_next_number(self, admin):
        r = admin.get(f"{API}/invoices/next-number")
        assert r.status_code == 200
        assert "number" in r.json()


# ---------------- Customer payment ----------------
class TestCustomerPayment:
    def test_payment_reduces_balance(self, admin, request):
        r = admin.post(f"{API}/customers", json={
            "name": f"{TAG}_PayCust", "phone": f"8{uuid.uuid4().int % 1000000000:09d}",
            "state": "Maharashtra", "opening_balance": 500,
        })
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        request.addfinalizer(lambda: admin.delete(f"{API}/customers/{cid}"))
        bal = admin.get(f"{API}/customers/{cid}").json()["balance"]
        assert bal == 500
        r2 = admin.post(f"{API}/customers/{cid}/payments", json={"amount": 200, "mode": "cash", "note": "test"})
        assert r2.status_code == 200
        bal2 = admin.get(f"{API}/customers/{cid}").json()["balance"]
        assert bal2 == 300


# ---------------- HSN ----------------
class TestHsn:
    def test_hsn_crud(self, admin, request):
        code = f"TST{uuid.uuid4().hex[:4].upper()}"
        r = admin.post(f"{API}/hsn", json={"code": code, "description": "Test", "gst_rate": 12})
        assert r.status_code == 200, r.text
        hid = r.json()["id"]
        request.addfinalizer(lambda: admin.delete(f"{API}/hsn/{hid}"))
        r2 = admin.put(f"{API}/hsn/{hid}", json={"code": code, "description": "Test2", "gst_rate": 18})
        assert r2.status_code == 200
        assert r2.json()["gst_rate"] == 18


# ---------------- Suppliers + Purchase ----------------
class TestPurchase:
    def test_purchase_updates_stock_and_balance(self, admin, request):
        r = admin.post(f"{API}/suppliers", json={
            "name": f"{TAG}_Supp", "phone": f"7{uuid.uuid4().int % 1000000000:09d}", "state": "Maharashtra",
        })
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        request.addfinalizer(lambda: admin.delete(f"{API}/suppliers/{sid}"))

        ri = admin.post(f"{API}/items", json={
            "part_no": f"{TAG}-PUR", "name": "pur item", "fitments": [], "hsn_code": "8714",
            "gst_rate": 18, "mrp": 100, "sale_price": 100, "purchase_price": 50, "stock": 0, "min_stock": 1, "unit": "PCS",
        })
        assert ri.status_code == 200
        iid = ri.json()["id"]
        request.addfinalizer(lambda: admin.delete(f"{API}/items/{iid}"))

        rp = admin.post(f"{API}/purchases", json={
            "supplier_id": sid, "bill_no": "T1",
            "lines": [{"item_id": iid, "qty": 10, "cost": 50, "gst_rate": 18}],
            "paid": 0, "mode": "cash",
        })
        assert rp.status_code == 200, rp.text
        assert admin.get(f"{API}/items/{iid}").json()["stock"] == 10
        assert admin.get(f"{API}/suppliers/{sid}").json()["balance"] > 0


# ---------------- Staff role restrictions ----------------
class TestStaffRole:
    @pytest.fixture(scope="class")
    def staff_token(self, admin, request):
        email = f"test_staff_{uuid.uuid4().hex[:6]}@test.local"
        pw = "StaffPass123"
        r = admin.post(f"{API}/users", json={"name": f"{TAG}_Staff", "email": email, "password": pw, "role": "staff"})
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        request.addfinalizer(lambda: admin.delete(f"{API}/users/{uid}"))
        rl = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert rl.status_code == 200
        return rl.json()["token"]

    def test_staff_cannot_see_purchase_price(self, staff_token):
        r = requests.get(f"{API}/items", headers={"Authorization": f"Bearer {staff_token}"})
        assert r.status_code == 200
        for it in r.json()["items"][:5]:
            assert "purchase_price" not in it

    def test_staff_blocked_users(self, staff_token):
        r = requests.get(f"{API}/users", headers={"Authorization": f"Bearer {staff_token}"})
        assert r.status_code == 403

    def test_staff_blocked_purchases(self, staff_token):
        r = requests.get(f"{API}/purchases", headers={"Authorization": f"Bearer {staff_token}"})
        assert r.status_code == 403

    def test_staff_blocked_settings_write(self, staff_token):
        r = requests.put(f"{API}/settings", headers={"Authorization": f"Bearer {staff_token}"}, json={"name": "X"})
        assert r.status_code == 403


# ---------------- Items import + stock import ----------------
class TestExcelImport:
    def test_items_import_and_stock_import(self, admin, request):
        pn = f"{TAG}-IMP1"
        r = admin.post(f"{API}/items/import", json={
            "rows": [{"part_no": pn, "name": "Imp1", "mrp": 100, "stock": 10, "hsn_code": "8714", "gst_rate": 18}],
            "update_existing": True,
        })
        assert r.status_code == 200
        assert r.json()["inserted"] >= 1

        # cleanup via lookup
        def cleanup():
            x = admin.get(f"{API}/items", params={"q": pn}).json()
            for it in x.get("items", []):
                if it["part_no"] == pn:
                    admin.delete(f"{API}/items/{it['id']}")
        request.addfinalizer(cleanup)

        # stock import add
        r2 = admin.post(f"{API}/items/stock-import", json={
            "rows": [{"part_no": pn, "qty": 5}, {"part_no": f"{TAG}-NOTFOUND", "qty": 3}],
            "mode": "add",
        })
        assert r2.status_code == 200
        body = r2.json()
        assert body["updated"] == 1
        assert f"{TAG}-NOTFOUND" in body["not_found"]
        found = admin.get(f"{API}/items", params={"q": pn}).json()["items"]
        assert any(i["stock"] == 15 for i in found if i["part_no"] == pn)


# ---------------- GST Report ----------------
class TestGstReport:
    def test_gst_report_returns_list(self, admin):
        from datetime import date
        today = date.today().isoformat()
        r = admin.get(f"{API}/reports/gst", params={"date_from": today, "date_to": today})
        assert r.status_code == 200
        assert isinstance(r.json(), list)
