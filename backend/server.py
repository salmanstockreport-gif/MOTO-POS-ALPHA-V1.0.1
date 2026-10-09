from core import (db, out, oid, now_iso, today_ist, fin_year, rx, r2, num, hash_password,
                  verify_password, create_token, get_current_user, require_admin)
import os
import logging
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import ReturnDocument, UpdateOne
from datetime import datetime, timedelta, timezone

app = FastAPI(title="MotoPOS")
api = APIRouter(prefix="/api")
logger = logging.getLogger("motopos")
Auth = Depends(get_current_user)
Admin = Depends(require_admin)


# ---------------- Models ----------------
class LoginIn(BaseModel):
    email: str
    password: str


class UserIn(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    role: Literal["admin", "staff"] = "staff"
    active: bool = True


class SettingsIn(BaseModel):
    name: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    gstin: str = ""
    state: str = ""
    invoice_prefix: str = "INV"
    upi_id: str = ""
    footer_note: str = ""
    allow_negative_stock: bool = False
    low_stock_default: int = 5
    logo: str = ""
    brand_auths: List[dict] = []


class HsnIn(BaseModel):
    code: str
    description: str = ""
    gst_rate: float = 18


class ItemIn(BaseModel):
    part_no: str
    name: str
    brand: str = ""
    category: str = ""
    fitments: List[str] = []
    hsn_code: str = ""
    gst_rate: float = 18
    mrp: float = 0
    sale_price: float = 0
    purchase_price: float = 0
    stock: float = 0
    min_stock: float = 5
    unit: str = "PCS"
    location: str = ""


class PartyIn(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    gstin: str = ""
    address: str = ""
    state: str = ""
    opening_balance: float = 0


class ImportIn(BaseModel):
    rows: List[dict]
    update_existing: bool = True


class StockImportIn(BaseModel):
    rows: List[dict]
    mode: Literal["add", "set"] = "add"


class PayLine(BaseModel):
    mode: Literal["cash", "upi", "card", "bank"]
    amount: float = Field(ge=0)


class InvLine(BaseModel):
    item_id: str
    qty: float = Field(gt=0)
    rate: float = Field(ge=0)
    discount: float = Field(default=0, ge=0, le=100)


class InvoiceIn(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str = ""
    customer_phone: str = ""
    vehicle_no: str = ""
    lines: List[InvLine]
    payments: List[PayLine] = []
    bill_discount: float = Field(default=0, ge=0)
    notes: str = ""


class PaymentIn(BaseModel):
    amount: float = Field(gt=0)
    mode: Literal["cash", "upi", "card", "bank"] = "cash"
    note: str = ""
    date: Optional[str] = None


class PurLine(BaseModel):
    item_id: str
    qty: float = Field(gt=0)
    cost: float = Field(ge=0)
    gst_rate: float = 18


class PurchaseIn(BaseModel):
    supplier_id: str
    bill_no: str = ""
    date: Optional[str] = None
    lines: List[PurLine]
    paid: float = Field(default=0, ge=0)
    mode: Literal["cash", "upi", "card", "bank"] = "cash"
    notes: str = ""


# ---------------- Helpers ----------------
def party_coll(ptype: str):
    if ptype not in ("customer", "supplier"):
        raise HTTPException(404, "Not found")
    return db.customers if ptype == "customer" else db.suppliers


async def add_ledger(ptype, pid, etype, debit, credit, ref="", ref_id="", mode="", note="", user=None, date=None):
    await db.ledger.insert_one({
        "party_type": ptype, "party_id": pid, "type": etype, "debit": r2(debit), "credit": r2(credit),
        "ref": ref, "ref_id": ref_id, "mode": mode, "note": note, "date": date or today_ist(),
        "created_at": now_iso(), "created_by": (user or {}).get("name", ""),
    })
    await party_coll(ptype).update_one({"_id": oid(pid)}, {"$inc": {"balance": r2(debit - credit)}})


async def next_seq(key: str) -> int:
    doc = await db.counters.find_one_and_update({"_id": key}, {"$inc": {"seq": 1}}, upsert=True,
                                                return_document=ReturnDocument.AFTER)
    return doc["seq"]


async def get_settings() -> dict:
    s = await db.settings.find_one({"_id": "shop"}) or {}
    s.pop("_id", None)
    return {**SettingsIn().model_dump(), **s}


def clean_item(user, doc):
    return out(doc, hide=() if user["role"] == "admin" else ("purchase_price",))


async def move_stock(item_id, part_no, qty, mtype, ref, user):
    await db.stock_movements.insert_one({"item_id": item_id, "part_no": part_no, "qty": qty, "type": mtype,
                                         "ref": ref, "date": today_ist(), "created_at": now_iso(),
                                         "created_by": user.get("name", "")})


# ---------------- Auth & Users ----------------
@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    email = body.email.strip().lower()
    ident = f"{request.client.host if request.client else ''}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("until", "") > now_iso():
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]) or not user.get("active", True):
        until = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$inc": {"count": 1}, "$set": {"until": until}},
                                           upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_many({"identifier": ident})
    u = out(user, hide=("password_hash",))
    return {"token": create_token(u["id"], email), "user": u}


@api.get("/auth/me")
async def me(user=Auth):
    return user


@api.get("/users")
async def list_users(_=Admin):
    return [out(u, hide=("password_hash",)) async for u in db.users.find().sort("name", 1)]


@api.post("/users")
async def create_user(body: UserIn, _=Admin):
    email = body.email.strip().lower()
    if not body.password or len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    doc = {"name": body.name, "email": email, "role": body.role, "active": body.active,
           "password_hash": hash_password(body.password), "created_at": now_iso()}
    r = await db.users.insert_one(doc)
    return out({**doc, "_id": r.inserted_id}, hide=("password_hash",))


@api.put("/users/{uid}")
async def update_user(uid: str, body: UserIn, admin=Admin):
    upd = {"name": body.name, "role": body.role, "active": body.active}
    if uid == admin["id"] and (body.role != "admin" or not body.active):
        raise HTTPException(400, "You cannot demote or disable yourself")
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")
        upd["password_hash"] = hash_password(body.password)
    await db.users.update_one({"_id": oid(uid)}, {"$set": upd})
    return out(await db.users.find_one({"_id": oid(uid)}), hide=("password_hash",))


@api.delete("/users/{uid}")
async def delete_user(uid: str, admin=Admin):
    if uid == admin["id"]:
        raise HTTPException(400, "You cannot delete yourself")
    await db.users.delete_one({"_id": oid(uid)})
    return {"ok": True}


# ---------------- Settings ----------------
@api.get("/settings")
async def read_settings(_=Auth):
    return await get_settings()


@api.put("/settings")
async def write_settings(body: SettingsIn, _=Admin):
    await db.settings.update_one({"_id": "shop"}, {"$set": body.model_dump()}, upsert=True)
    return await get_settings()


# ---------------- HSN ----------------
@api.get("/hsn")
async def list_hsn(q: str = "", _=Auth):
    f = {"$or": [{"code": rx(q)}, {"description": rx(q)}]} if q else {}
    rows = [out(h) async for h in db.hsn.find(f).sort("code", 1)]
    for h in rows:
        h["item_count"] = await db.items.count_documents({"hsn_code": h["code"]})
    return rows


@api.post("/hsn")
async def create_hsn(body: HsnIn, _=Admin):
    code = body.code.strip()
    if await db.hsn.find_one({"code": code}):
        raise HTTPException(400, "HSN code already exists")
    doc = {**body.model_dump(), "code": code, "created_at": now_iso()}
    r = await db.hsn.insert_one(doc)
    return out({**doc, "_id": r.inserted_id})


@api.put("/hsn/{hid}")
async def update_hsn(hid: str, body: HsnIn, apply_to_items: bool = False, _=Admin):
    await db.hsn.update_one({"_id": oid(hid)}, {"$set": {**body.model_dump(), "code": body.code.strip()}})
    updated = 0
    if apply_to_items:
        r = await db.items.update_many({"hsn_code": body.code.strip()}, {"$set": {"gst_rate": body.gst_rate}})
        updated = r.modified_count
    return {**out(await db.hsn.find_one({"_id": oid(hid)})), "items_updated": updated}


@api.delete("/hsn/{hid}")
async def delete_hsn(hid: str, _=Admin):
    await db.hsn.delete_one({"_id": oid(hid)})
    return {"ok": True}


# ---------------- Items ----------------
SEARCH_FIELDS = ("part_no", "name", "fitments", "brand", "category", "hsn_code", "location")


def item_search(q: str) -> dict:
    tokens = [t for t in q.replace(",", " ").split() if t]
    if not tokens:
        return {}
    return {"$and": [{"$or": [{k: rx(t)} for k in SEARCH_FIELDS]} for t in tokens]}


@api.get("/items")
async def list_items(q: str = "", low_stock: bool = False, limit: int = 50, skip: int = 0, user=Auth):
    f = item_search(q)
    if low_stock:
        f["$expr"] = {"$lte": ["$stock", "$min_stock"]}
    total = await db.items.count_documents(f)
    cur = db.items.find(f).sort("part_no", 1).skip(skip).limit(min(limit, 500))
    return {"total": total, "items": [clean_item(user, d) async for d in cur]}


@api.get("/items/meta")
async def items_meta(_=Auth):
    return {"fitments": sorted([f for f in await db.items.distinct("fitments") if f]),
            "categories": sorted([c for c in await db.items.distinct("category") if c]),
            "brands": sorted([b for b in await db.items.distinct("brand") if b])}


@api.get("/items/{iid}")
async def get_item(iid: str, user=Auth):
    d = await db.items.find_one({"_id": oid(iid)})
    if not d:
        raise HTTPException(404, "Item not found")
    item = clean_item(user, d)
    item["movements"] = [out(m) async for m in db.stock_movements.find({"item_id": iid}).sort("created_at", -1).limit(30)]
    return item


@api.post("/items")
async def create_item(body: ItemIn, user=Admin):
    data = body.model_dump()
    data["part_no"] = data["part_no"].strip().upper()
    if await db.items.find_one({"part_no": data["part_no"]}):
        raise HTTPException(400, "Part number already exists")
    data.update(created_at=now_iso(), updated_at=now_iso())
    r = await db.items.insert_one(data)
    if data["stock"]:
        await move_stock(str(r.inserted_id), data["part_no"], data["stock"], "opening", "", user)
    return out({**data, "_id": r.inserted_id})


@api.put("/items/{iid}")
async def update_item(iid: str, body: ItemIn, user=Admin):
    data = body.model_dump()
    data["part_no"] = data["part_no"].strip().upper()
    dup = await db.items.find_one({"part_no": data["part_no"], "_id": {"$ne": oid(iid)}})
    if dup:
        raise HTTPException(400, "Part number already exists")
    old = await db.items.find_one({"_id": oid(iid)})
    if not old:
        raise HTTPException(404, "Item not found")
    data["updated_at"] = now_iso()
    await db.items.update_one({"_id": oid(iid)}, {"$set": data})
    diff = data["stock"] - old.get("stock", 0)
    if diff:
        await move_stock(iid, data["part_no"], diff, "adjustment", "manual edit", user)
    return out(await db.items.find_one({"_id": oid(iid)}))


@api.delete("/items/{iid}")
async def delete_item(iid: str, _=Admin):
    await db.items.delete_one({"_id": oid(iid)})
    return {"ok": True}


def split_fitments(v) -> List[str]:
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    parts = str(v or "").replace(";", ",").replace("|", ",").replace("/", ",").split(",")
    return [p.strip() for p in parts if p.strip()]


@api.post("/items/import")
async def import_items(body: ImportIn, user=Admin):
    hsn_map = {h["code"]: h["gst_rate"] async for h in db.hsn.find()}
    ops, errors, new_hsn = [], [], {}
    seen = set()
    for i, row in enumerate(body.rows):
        pn = str(row.get("part_no") or "").strip().upper()
        if not pn:
            errors.append({"row": i + 2, "error": "Missing part number"})
            continue
        if pn in seen:
            errors.append({"row": i + 2, "error": f"Duplicate part number {pn} in file"})
            continue
        seen.add(pn)
        hsn = str(row.get("hsn_code") or "").strip().split(".")[0]
        gst = num(row.get("gst_rate"), -1)
        if 0 < gst < 1:
            gst = gst * 100
        if gst < 0:
            gst = hsn_map.get(hsn, 18)
        if hsn and hsn not in hsn_map:
            new_hsn[hsn] = gst
        fields = {"part_no": pn, "updated_at": now_iso()}
        for k in ("name", "brand", "category", "unit", "location"):
            if row.get(k) not in (None, ""):
                fields[k] = str(row[k]).strip()
        for k in ("mrp", "sale_price", "purchase_price", "stock", "min_stock"):
            if row.get(k) not in (None, ""):
                fields[k] = num(row[k])
        if "sale_price" not in fields and "mrp" in fields:
            fields["sale_price"] = fields["mrp"]
        if row.get("fitments") not in (None, ""):
            fields["fitments"] = split_fitments(row["fitments"])
        if hsn:
            fields["hsn_code"] = hsn
        fields["gst_rate"] = gst
        defaults = {"name": pn, "brand": "", "category": "", "fitments": [], "hsn_code": "", "mrp": 0,
                    "sale_price": 0, "purchase_price": 0, "stock": 0, "min_stock": 5, "unit": "PCS",
                    "location": "", "created_at": now_iso()}
        on_insert = {k: v for k, v in defaults.items() if k not in fields}
        if body.update_existing:
            ops.append(UpdateOne({"part_no": pn}, {"$set": fields, "$setOnInsert": on_insert}, upsert=True))
        else:
            ops.append(UpdateOne({"part_no": pn}, {"$setOnInsert": {**on_insert, **fields}}, upsert=True))
    inserted = updated = 0
    if ops:
        res = await db.items.bulk_write(ops, ordered=False)
        inserted, updated = res.upserted_count, res.modified_count
    for code, rate in new_hsn.items():
        await db.hsn.update_one({"code": code}, {"$setOnInsert": {"code": code, "description": "Imported",
                                                                  "gst_rate": rate, "created_at": now_iso()}},
                                upsert=True)
    return {"inserted": inserted, "updated": updated, "errors": errors, "new_hsn": list(new_hsn.keys())}


@api.post("/items/stock-import")
async def stock_import(body: StockImportIn, user=Admin):
    not_found, errors, done = [], [], 0
    for i, row in enumerate(body.rows):
        pn = str(row.get("part_no") or "").strip().upper()
        if not pn or row.get("qty") in (None, ""):
            errors.append({"row": i + 2, "error": "Missing part number or quantity"})
            continue
        qty = num(row["qty"])
        item = await db.items.find_one({"part_no": pn})
        if not item:
            not_found.append(pn)
            continue
        if body.mode == "add":
            await db.items.update_one({"_id": item["_id"]}, {"$inc": {"stock": qty}, "$set": {"updated_at": now_iso()}})
            change = qty
        else:
            await db.items.update_one({"_id": item["_id"]}, {"$set": {"stock": qty, "updated_at": now_iso()}})
            change = qty - item.get("stock", 0)
        if change:
            await move_stock(str(item["_id"]), pn, change, "excel_import", body.mode, user)
        done += 1
    return {"updated": done, "not_found": not_found, "errors": errors}


# ---------------- Parties (customers / suppliers) ----------------
def party_routes(ptype: str, path: str):
    coll = party_coll(ptype)

    @api.get(f"/{path}", name=f"list_{path}")
    async def list_parties(q: str = "", with_balance: bool = False, limit: int = 200, _=Auth):
        f = {"$or": [{"name": rx(q)}, {"phone": rx(q)}, {"gstin": rx(q)}]} if q else {}
        if with_balance:
            f["balance"] = {"$gt": 0.009}
        return [out(c) async for c in coll.find(f).sort("name", 1).limit(min(limit, 1000))]

    @api.post(f"/{path}", name=f"create_{path}")
    async def create_party(body: PartyIn, user=Auth):
        if ptype == "supplier" and user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        data = body.model_dump()
        ob = data.pop("opening_balance")
        if data["phone"] and await coll.find_one({"phone": data["phone"]}):
            raise HTTPException(400, "A party with this phone already exists")
        data.update(balance=0, created_at=now_iso())
        r = await coll.insert_one(data)
        pid = str(r.inserted_id)
        if ob:
            await add_ledger(ptype, pid, "opening", max(ob, 0), max(-ob, 0), note="Opening balance", user=user)
        return out(await coll.find_one({"_id": r.inserted_id}))

    @api.get(f"/{path}/{{pid}}", name=f"get_{path}")
    async def get_party(pid: str, _=Auth):
        d = await coll.find_one({"_id": oid(pid)})
        if not d:
            raise HTTPException(404, "Not found")
        return out(d)

    @api.put(f"/{path}/{{pid}}", name=f"update_{path}")
    async def update_party(pid: str, body: PartyIn, user=Auth):
        data = body.model_dump()
        data.pop("opening_balance")
        await coll.update_one({"_id": oid(pid)}, {"$set": data})
        return out(await coll.find_one({"_id": oid(pid)}))

    @api.delete(f"/{path}/{{pid}}", name=f"delete_{path}")
    async def delete_party(pid: str, _=Admin):
        if await db.ledger.count_documents({"party_type": ptype, "party_id": pid}):
            raise HTTPException(400, "Cannot delete: party has ledger transactions")
        await coll.delete_one({"_id": oid(pid)})
        return {"ok": True}

    @api.get(f"/{path}/{{pid}}/ledger", name=f"ledger_{path}")
    async def party_ledger(pid: str, _=Auth):
        rows = [out(e) async for e in db.ledger.find({"party_type": ptype, "party_id": pid}).sort("created_at", 1)]
        bal = 0.0
        for e in rows:
            bal = r2(bal + e["debit"] - e["credit"])
            e["balance"] = bal
        return rows

    @api.post(f"/{path}/{{pid}}/payments", name=f"pay_{path}")
    async def party_payment(pid: str, body: PaymentIn, user=Auth):
        if ptype == "supplier" and user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        if not await coll.find_one({"_id": oid(pid)}):
            raise HTTPException(404, "Not found")
        seq = await next_seq(f"receipt_{ptype}_{fin_year()}")
        ref = f"{'RCPT' if ptype == 'customer' else 'PAY'}/{fin_year()}/{seq:05d}"
        label = "Payment received" if ptype == "customer" else "Payment made"
        await add_ledger(ptype, pid, "payment", 0, body.amount, ref, mode=body.mode,
                         note=body.note or label, user=user, date=body.date)
        return {"ok": True, "ref": ref, "party": out(await coll.find_one({"_id": oid(pid)}))}


party_routes("customer", "customers")
party_routes("supplier", "suppliers")


# ---------------- Invoices ----------------
@api.post("/invoices")
async def create_invoice(body: InvoiceIn, user=Auth):
    if not body.lines:
        raise HTTPException(400, "Cart is empty")
    settings = await get_settings()
    customer = None
    if body.customer_id:
        customer = await db.customers.find_one({"_id": oid(body.customer_id)})
        if not customer:
            raise HTTPException(404, "Customer not found")
    interstate = bool(customer and customer.get("state") and settings["state"]
                      and customer["state"].strip().lower() != settings["state"].strip().lower())

    lines, reserved = [], []
    try:
        for ln in body.lines:
            cond = {"_id": oid(ln.item_id)}
            if not settings["allow_negative_stock"]:
                cond["stock"] = {"$gte": ln.qty}
            item = await db.items.find_one_and_update(cond, {"$inc": {"stock": -ln.qty}},
                                                      return_document=ReturnDocument.AFTER)
            if not item:
                exist = await db.items.find_one({"_id": oid(ln.item_id)})
                if not exist:
                    raise HTTPException(404, "Item not found")
                raise HTTPException(409, f"Insufficient stock for {exist['part_no']} (available {exist.get('stock', 0):g})")
            reserved.append((ln.item_id, ln.qty, item))
            gross = r2(ln.qty * ln.rate * (1 - ln.discount / 100))
            rate = item.get("gst_rate", 18)
            taxable = r2(gross / (1 + rate / 100))
            tax = r2(gross - taxable)
            lines.append({"item_id": ln.item_id, "part_no": item["part_no"], "name": item["name"],
                          "hsn_code": item.get("hsn_code", ""), "unit": item.get("unit", "PCS"),
                          "brand": item.get("brand", ""), "location": item.get("location", ""),
                          "mrp": item.get("mrp", 0), "qty": ln.qty, "rate": ln.rate, "discount": ln.discount,
                          "gst_rate": rate, "taxable": taxable,
                          "cgst": 0 if interstate else r2(tax / 2), "sgst": 0 if interstate else r2(tax - r2(tax / 2)),
                          "igst": tax if interstate else 0, "total": gross})
    except HTTPException:
        for iid, q, _ in reserved:
            await db.items.update_one({"_id": oid(iid)}, {"$inc": {"stock": q}})
        raise

    subtotal = r2(sum(x["total"] for x in lines))
    bill_disc = min(body.bill_discount, subtotal)
    if bill_disc:
        factor = (subtotal - bill_disc) / subtotal if subtotal else 0
        for x in lines:
            x["total"] = r2(x["total"] * factor)
            x["taxable"] = r2(x["total"] / (1 + x["gst_rate"] / 100))
            tax = r2(x["total"] - x["taxable"])
            x["igst"] = tax if interstate else 0
            x["cgst"] = 0 if interstate else r2(tax / 2)
            x["sgst"] = 0 if interstate else r2(tax - x["cgst"])
    total = r2(sum(x["total"] for x in lines))
    grand = float(round(total))
    tendered = r2(sum(p.amount for p in body.payments))
    paid = min(tendered, grand)
    due = r2(grand - paid)
    if due > 0.009 and not customer:
        for iid, q, _ in reserved:
            await db.items.update_one({"_id": oid(iid)}, {"$inc": {"stock": q}})
        raise HTTPException(400, "Select a customer to bill on credit (unpaid balance)")

    seq = await next_seq(f"invoice_{fin_year()}")
    number = f"{settings['invoice_prefix']}/{fin_year()}/{seq:05d}"
    inv = {
        "number": number, "seq": seq, "date": today_ist(), "created_at": now_iso(),
        "created_by": user["name"], "created_by_id": user["id"], "status": "active",
        "customer_id": body.customer_id,
        "customer": {"name": customer["name"] if customer else (body.customer_name or "Walk-in Customer"),
                     "phone": customer.get("phone", "") if customer else body.customer_phone,
                     "gstin": customer.get("gstin", "") if customer else "",
                     "address": customer.get("address", "") if customer else "",
                     "state": customer.get("state", "") if customer else ""},
        "vehicle_no": body.vehicle_no, "interstate": interstate, "lines": lines,
        "subtotal": subtotal, "bill_discount": r2(bill_disc),
        "taxable_total": r2(sum(x["taxable"] for x in lines)),
        "cgst_total": r2(sum(x["cgst"] for x in lines)), "sgst_total": r2(sum(x["sgst"] for x in lines)),
        "igst_total": r2(sum(x["igst"] for x in lines)),
        "round_off": r2(grand - total), "grand_total": grand,
        "payments": [p.model_dump() for p in body.payments if p.amount > 0],
        "tendered": tendered, "change": r2(max(tendered - grand, 0)), "paid": paid, "due": due,
        "payment_status": "paid" if due <= 0.009 else ("partial" if paid > 0 else "credit"),
        "notes": body.notes,
    }
    r = await db.invoices.insert_one(inv)
    inv_id = str(r.inserted_id)
    for iid, q, item in reserved:
        await move_stock(iid, item["part_no"], -q, "sale", number, user)
    if customer:
        await add_ledger("customer", body.customer_id, "invoice", grand, 0, number, inv_id, note="Sales invoice", user=user)
        if paid > 0:
            modes = ", ".join(sorted({p.mode for p in body.payments if p.amount > 0}))
            await add_ledger("customer", body.customer_id, "payment", 0, paid, number, inv_id, mode=modes,
                             note="Paid at billing", user=user)
    return out({**inv, "_id": r.inserted_id})


@api.get("/invoices")
async def list_invoices(q: str = "", date_from: str = "", date_to: str = "", status: str = "",
                        customer_id: str = "", limit: int = 100, skip: int = 0, _=Auth):
    f = {}
    if q:
        f["$or"] = [{"number": rx(q)}, {"customer.name": rx(q)}, {"customer.phone": rx(q)}, {"vehicle_no": rx(q)}]
    if date_from or date_to:
        f["date"] = {**({"$gte": date_from} if date_from else {}), **({"$lte": date_to} if date_to else {})}
    if status:
        f["payment_status" if status in ("paid", "partial", "credit") else "status"] = status
    if customer_id:
        f["customer_id"] = customer_id
    total = await db.invoices.count_documents(f)
    cur = db.invoices.find(f, {"lines": 0}).sort("created_at", -1).skip(skip).limit(min(limit, 500))
    return {"total": total, "invoices": [out(d) async for d in cur]}


@api.get("/invoices/next-number")
async def next_invoice_number(_=Auth):
    s = await get_settings()
    c = await db.counters.find_one({"_id": f"invoice_{fin_year()}"}) or {"seq": 0}
    return {"number": f"{s['invoice_prefix']}/{fin_year()}/{c['seq'] + 1:05d}", "date": today_ist()}


@api.get("/invoices/{iid}")
async def get_invoice(iid: str, _=Auth):
    d = await db.invoices.find_one({"_id": oid(iid)})
    if not d:
        raise HTTPException(404, "Invoice not found")
    return out(d)


@api.post("/invoices/{iid}/cancel")
async def cancel_invoice(iid: str, user=Admin):
    inv = await db.invoices.find_one_and_update({"_id": oid(iid), "status": "active"},
                                                {"$set": {"status": "cancelled", "cancelled_at": now_iso(),
                                                          "cancelled_by": user["name"]}})
    if not inv:
        raise HTTPException(400, "Invoice not found or already cancelled")
    for ln in inv["lines"]:
        await db.items.update_one({"_id": oid(ln["item_id"])}, {"$inc": {"stock": ln["qty"]}})
        await move_stock(ln["item_id"], ln["part_no"], ln["qty"], "sale_cancel", inv["number"], user)
    if inv.get("customer_id"):
        await add_ledger("customer", inv["customer_id"], "cancel", 0, inv["grand_total"], inv["number"], iid,
                         note="Invoice cancelled", user=user)
        if inv["paid"] > 0:
            await add_ledger("customer", inv["customer_id"], "refund", inv["paid"], 0, inv["number"], iid,
                             note="Payment reversed (cancelled)", user=user)
    return {"ok": True}


# ---------------- Purchases ----------------
@api.post("/purchases")
async def create_purchase(body: PurchaseIn, user=Admin):
    sup = await db.suppliers.find_one({"_id": oid(body.supplier_id)})
    if not sup:
        raise HTTPException(404, "Supplier not found")
    if not body.lines:
        raise HTTPException(400, "Add at least one item")
    lines = []
    for ln in body.lines:
        item = await db.items.find_one_and_update(
            {"_id": oid(ln.item_id)},
            {"$inc": {"stock": ln.qty}, "$set": {"purchase_price": ln.cost, "updated_at": now_iso()}})
        if not item:
            raise HTTPException(404, "Item not found")
        taxable = r2(ln.qty * ln.cost)
        tax = r2(taxable * ln.gst_rate / 100)
        lines.append({"item_id": ln.item_id, "part_no": item["part_no"], "name": item["name"],
                      "hsn_code": item.get("hsn_code", ""), "qty": ln.qty, "cost": ln.cost,
                      "gst_rate": ln.gst_rate, "taxable": taxable, "tax": tax, "total": r2(taxable + tax)})
    total = r2(sum(x["total"] for x in lines))
    seq = await next_seq(f"purchase_{fin_year()}")
    doc = {"number": f"PUR/{fin_year()}/{seq:05d}", "supplier_id": body.supplier_id, "supplier_name": sup["name"],
           "bill_no": body.bill_no, "date": body.date or today_ist(), "lines": lines,
           "taxable_total": r2(sum(x["taxable"] for x in lines)), "tax_total": r2(sum(x["tax"] for x in lines)),
           "total": total, "paid": min(body.paid, total), "due": r2(total - min(body.paid, total)),
           "notes": body.notes, "created_at": now_iso(), "created_by": user["name"]}
    r = await db.purchases.insert_one(doc)
    pid = str(r.inserted_id)
    for x in lines:
        await move_stock(x["item_id"], x["part_no"], x["qty"], "purchase", doc["number"], user)
    await add_ledger("supplier", body.supplier_id, "purchase", total, 0, doc["number"], pid,
                     note=f"Purchase bill {body.bill_no}".strip(), user=user, date=doc["date"])
    if doc["paid"] > 0:
        await add_ledger("supplier", body.supplier_id, "payment", 0, doc["paid"], doc["number"], pid,
                         mode=body.mode, note="Paid with purchase", user=user, date=doc["date"])
    return out({**doc, "_id": r.inserted_id})


@api.get("/purchases")
async def list_purchases(q: str = "", limit: int = 100, _=Admin):
    f = {"$or": [{"number": rx(q)}, {"supplier_name": rx(q)}, {"bill_no": rx(q)}]} if q else {}
    return [out(d) async for d in db.purchases.find(f).sort("created_at", -1).limit(min(limit, 500))]


@api.get("/purchases/{pid}")
async def get_purchase(pid: str, _=Admin):
    d = await db.purchases.find_one({"_id": oid(pid)})
    if not d:
        raise HTTPException(404, "Not found")
    return out(d)


# ---------------- Dashboard & Reports ----------------
@api.get("/dashboard")
async def dashboard(_=Auth):
    today = today_ist()
    active = {"status": "active"}
    agg = await db.invoices.aggregate([{"$match": {**active, "date": today}},
                                       {"$group": {"_id": None, "sales": {"$sum": "$grand_total"},
                                                   "count": {"$sum": 1}, "due": {"$sum": "$due"}}}]).to_list(1)
    t = agg[0] if agg else {"sales": 0, "count": 0, "due": 0}
    coll = await db.ledger.aggregate([{"$match": {"party_type": "customer", "type": "payment", "date": today}},
                                      {"$group": {"_id": None, "amt": {"$sum": "$credit"}}}]).to_list(1)
    walkin = await db.invoices.aggregate([{"$match": {**active, "date": today, "customer_id": None}},
                                          {"$group": {"_id": None, "amt": {"$sum": "$paid"}}}]).to_list(1)
    modes = await db.invoices.aggregate([{"$match": {**active, "date": today}}, {"$unwind": "$payments"},
                                         {"$group": {"_id": "$payments.mode", "amt": {"$sum": "$payments.amount"}}}]).to_list(10)
    recv = await db.customers.aggregate([{"$match": {"balance": {"$gt": 0}}},
                                         {"$group": {"_id": None, "amt": {"$sum": "$balance"}}}]).to_list(1)
    low_f = {"$expr": {"$lte": ["$stock", "$min_stock"]}}
    start = (datetime.now(timezone(timedelta(hours=5, minutes=30))) - timedelta(days=6)).strftime("%Y-%m-%d")
    days = await db.invoices.aggregate([{"$match": {**active, "date": {"$gte": start}}},
                                        {"$group": {"_id": "$date", "sales": {"$sum": "$grand_total"}}},
                                        {"$sort": {"_id": 1}}]).to_list(10)
    top = await db.invoices.aggregate([{"$match": {**active, "date": {"$gte": start}}}, {"$unwind": "$lines"},
                                       {"$group": {"_id": "$lines.part_no", "name": {"$first": "$lines.name"},
                                                   "qty": {"$sum": "$lines.qty"}, "amt": {"$sum": "$lines.total"}}},
                                       {"$sort": {"amt": -1}}, {"$limit": 5}]).to_list(5)
    dmap = {d["_id"]: d["sales"] for d in days}
    series = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone(timedelta(hours=5, minutes=30))) - timedelta(days=i)).strftime("%Y-%m-%d")
        series.append({"date": d, "sales": r2(dmap.get(d, 0))})
    return {
        "today_sales": r2(t["sales"]), "today_count": t["count"], "today_credit": r2(t["due"]),
        "today_collection": r2((coll[0]["amt"] if coll else 0) + (walkin[0]["amt"] if walkin else 0)),
        "modes": {m["_id"]: r2(m["amt"]) for m in modes},
        "receivable": r2(recv[0]["amt"] if recv else 0),
        "low_stock_count": await db.items.count_documents(low_f),
        "low_stock": [out(i, hide=("purchase_price",)) async for i in db.items.find(low_f).sort("stock", 1).limit(8)],
        "item_count": await db.items.count_documents({}),
        "series": series, "top_items": [{"part_no": x["_id"], "name": x["name"], "qty": x["qty"], "amt": r2(x["amt"])} for x in top],
        "recent": [out(d) async for d in db.invoices.find({}, {"lines": 0}).sort("created_at", -1).limit(6)],
    }


@api.get("/reports/gst")
async def gst_report(date_from: str, date_to: str, _=Admin):
    rows = await db.invoices.aggregate([
        {"$match": {"status": "active", "date": {"$gte": date_from, "$lte": date_to}}}, {"$unwind": "$lines"},
        {"$group": {"_id": {"hsn": "$lines.hsn_code", "rate": "$lines.gst_rate"}, "qty": {"$sum": "$lines.qty"},
                    "taxable": {"$sum": "$lines.taxable"}, "cgst": {"$sum": "$lines.cgst"},
                    "sgst": {"$sum": "$lines.sgst"}, "igst": {"$sum": "$lines.igst"}, "total": {"$sum": "$lines.total"}}},
        {"$sort": {"_id.hsn": 1}}]).to_list(1000)
    return [{"hsn_code": r["_id"]["hsn"], "gst_rate": r["_id"]["rate"], "qty": r["qty"],
             **{k: r2(r[k]) for k in ("taxable", "cgst", "sgst", "igst", "total")}} for r in rows]


@api.get("/")
async def root():
    return {"app": "MotoPOS", "status": "ok"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_credentials=False, allow_methods=["*"], allow_headers=["*"])


# ---------------- Startup / Seed ----------------
SEED_HSN = [("8714", "Parts & accessories of motorcycles", 18), ("8511", "Spark plugs & ignition equipment", 18),
            ("4011", "Pneumatic tyres of rubber", 18), ("2710", "Lubricating oils", 18),
            ("8507", "Electric accumulators (batteries)", 18), ("8512", "Lighting & signalling equipment", 18),
            ("4016", "Articles of vulcanised rubber", 18), ("8483", "Transmission shafts, chains, gears", 18)]

SEED_ITEMS = [
    ("RG6YC", "Spark Plug Champion RG6YC", "Champion", "Ignition", ["Hero Splendor", "Hero Passion", "Honda Shine"], "8511", 140, 95, 40, 10),
    ("BP-PUL150-F", "Brake Pad Front Bajaj Pulsar 150", "Bajaj Genuine", "Brakes", ["Bajaj Pulsar 150", "Bajaj Pulsar 180"], "8714", 420, 290, 18, 5),
    ("CP-SPL-PRO", "Clutch Plate Set Hero Splendor Pro", "Hero Genuine", "Clutch", ["Hero Splendor Pro", "Hero Splendor Plus"], "8714", 650, 470, 12, 4),
    ("CSK-APACHE160", "Chain Sprocket Kit TVS Apache RTR 160", "Rolon", "Transmission", ["TVS Apache RTR 160", "TVS Apache RTR 180"], "8483", 1450, 1050, 6, 3),
    ("AF-ACT6G", "Air Filter Honda Activa 6G", "Honda Genuine", "Filters", ["Honda Activa 6G", "Honda Activa 125"], "8714", 260, 170, 3, 5),
    ("MOTUL-20W40-1L", "Engine Oil Motul 3100 20W40 1L", "Motul", "Lubricants", ["Universal"], "2710", 450, 340, 48, 12),
    ("BAT-EXIDE-5L", "Battery Exide Xplore 12V 5Ah", "Exide", "Electrical", ["Hero Splendor", "Bajaj Platina", "TVS Star City"], "8507", 1650, 1250, 2, 3),
    ("HL-BULB-H4", "Headlight Bulb H4 12V 35/35W", "Philips", "Lighting", ["Bajaj Pulsar 150", "Royal Enfield Classic 350"], "8512", 220, 140, 25, 8),
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.items.create_index("part_no", unique=True)
    await db.items.create_index("fitments")
    await db.items.create_index("name")
    await db.hsn.create_index("code", unique=True)
    await db.invoices.create_index("number", unique=True)
    await db.invoices.create_index([("date", -1)])
    await db.invoices.create_index("customer_id")
    await db.ledger.create_index([("party_type", 1), ("party_id", 1), ("created_at", 1)])
    await db.customers.create_index("phone")
    await db.stock_movements.create_index([("item_id", 1), ("created_at", -1)])

    email, pwd = os.environ["ADMIN_EMAIL"].lower(), os.environ["ADMIN_PASSWORD"]
    ex = await db.users.find_one({"email": email})
    if not ex:
        await db.users.insert_one({"email": email, "name": "Owner", "role": "admin", "active": True,
                                   "password_hash": hash_password(pwd), "created_at": now_iso()})
    elif not verify_password(pwd, ex["password_hash"]):
        await db.users.update_one({"_id": ex["_id"]}, {"$set": {"password_hash": hash_password(pwd)}})

    if not await db.settings.find_one({"_id": "shop"}):
        await db.settings.insert_one({"_id": "shop", **SettingsIn(name="My Moto Parts Store", state="Maharashtra").model_dump()})
    if await db.hsn.count_documents({}) == 0:
        await db.hsn.insert_many([{"code": c, "description": d, "gst_rate": g, "created_at": now_iso()} for c, d, g in SEED_HSN])
    if await db.items.count_documents({}) == 0:
        await db.items.insert_many([{
            "part_no": p, "name": n, "brand": b, "category": c, "fitments": f, "hsn_code": h, "gst_rate": 18,
            "mrp": m, "sale_price": m, "purchase_price": cost, "stock": s, "min_stock": mn, "unit": "PCS",
            "location": "", "created_at": now_iso(), "updated_at": now_iso()}
            for p, n, b, c, f, h, m, cost, s, mn in SEED_ITEMS])


@app.on_event("shutdown")
async def shutdown():
    from core import client
    client.close()
