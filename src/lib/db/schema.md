# Database Schema - Plain English Guide

This document explains every table in schema.sql, what it stores, and how the tables connect. No SQL knowledge required.

---

## The Big Picture

The app has one core concept: the **HULLC core inventory** manages a catalogue of products, tracks stock (in lots), records every dispense, and handles requests from departments. Think of it like a stockroom with a request desk.

How everything connects:

    products
      |-- lots           (a product arrives in batches)
           |-- lot_files (each batch can have one document attached)

    product_requests             (departments ask for stock)
      |-- fulfillments           (admin works to satisfy a request)
           |-- transactions      (admin actually dispenses stock)
                |-- transaction_items  (one line per lot drawn from)

---

## Table by Table

---

### users

**What it stores:** Everyone who logs into the system.

Each user has a **role** (Admin or Staff) and a **department** (like Cardiology, or "core" for the central inventory team). Admins can do everything. Staff can browse products and submit requests.

Right now the app has no real credentials - the user picks a role and department from a screen. This table is the foundation for adding proper authentication later.

---

### products

**What it stores:** The master catalogue of items the core inventory stocks.

Every product has a name, vendor, and vendor part number. There is also an optional **reorder threshold** - if total quantity drops below this, the system shows a low-stock alert.

Product IDs use the format P001, P002, etc. - matching the existing numbering logic in the application.

**Connected to:** lots (a product has one or more lots)

---

### lots

**What it stores:** Individual shipments (batches) of a product.

When stock arrives, it is recorded as a lot. Each lot tracks:
- **Lot number** - the batch ID printed on the box
- **Quantity** - how many units are currently available
- **Receipt date** - when it arrived
- **Expiration date** - when it expires (optional - some items do not expire)
- **Location** - which shelf or room it is stored in
- **Notes** - any freeform observations

When someone dispenses from a lot, the quantity decreases. A products total stock is the sum of all its lot quantities.

If a product is deleted, all its lots are automatically deleted too (cascade delete).

**Connected to:** products (parent), lot_files (optional attachment), transaction_items (dispense records)

---

### lot_files

**What it stores:** The name and type of a document attached to a lot.

A staff member can upload a PDF, JPEG, or TIFF to a lot - for example, a Certificate of Analysis (COA). This table stores just the **metadata**: filename and MIME type.

The actual file bytes are **not** stored in the database. They live in external object storage (Amazon S3, Google Cloud Storage, etc.), using the file UUID as the key.

Rule: **one lot can have at most one file**. Replace a file by deleting the old record and inserting a new one.

If the lot is deleted, its file record is automatically deleted too.

**Connected to:** lots (one file belongs to one lot)

---

### product_requests

**What it stores:** A formal request from a department asking for stock.

When a researcher needs reagent, they submit a product request capturing:
- Who is asking (name and email)
- Which department and project this is for
- How many units they need
- A justification
- Confirmation they have read SOP-30037.01

Lifecycle: **Pending -> In Progress -> Completed**, or **Pending -> Rejected** (with a note).

A product cannot be deleted while it has open requests.

**Connected to:** products (what is requested), fulfillments (the admin response)

---

### fulfillments

**What it stores:** The admin work order to satisfy a product request.

When an admin acts on a request, they create a fulfillment. It tracks:
- Which request it is responding to
- Which product is being dispensed
- Which department will receive it
- The total quantity asked for

Dispensing is tracked via transactions linked to this fulfillment. There can be multiple dispense events per fulfillment.

Rule: **one fulfillment per request** - enforced at the database level.

**Connected to:** product_requests, products, transactions

---

### transactions

**What it stores:** A record of stock being dispensed from the core inventory.

Every dispense event creates a transaction recording:
- Which product was dispensed
- The date and notes
- The total quantity that went out
- Optionally, who requested it and which department
- Optionally, which fulfillment this is part of

Transactions without a fulfillment link are **ad-hoc** dispenses.

If a fulfillment is cancelled, the fulfillment_id is set to null but the transaction is preserved for the audit trail.

**Connected to:** products, fulfillments, transaction_items

---

### transaction_items

**What it stores:** Per-lot line items within a transaction.

A single dispense might draw from multiple lots - for example, 20 from Lot A and 10 from Lot B. Each is a separate row.

Each row records:
- Which lot was drawn from
- The lot number (snapshot - stable even if the lot is later corrected)
- How many units were taken

If a transaction is deleted, its line items are deleted automatically. You cannot delete a lot that has transaction items - doing so would erase history.

**Connected to:** transactions (parent), lots (which lot was drawn from)

---

## How Cascade Deletes Work

Cascade means: deleting a parent automatically deletes its children.

| If you delete...  | These are also deleted automatically           |
|-------------------|------------------------------------------------|
| A product         | All its lots, and those lots files             |
| A lot             | Its attached file record (not the binary)      |
| A transaction     | All its transaction items                      |

RESTRICT means: the database refuses to delete a parent while children exist.

| You cannot delete a... | While it has...                        |
|------------------------|----------------------------------------|
| product               | Open product requests or transactions   |
| lot                   | Transaction items referencing it        |
| product request       | A fulfillment attached to it            |

---

## Why Some Data Is Duplicated (Denormalization)

Columns like product_name appear in transactions, product_requests, and fulfillments even though the name already lives in products. This is intentional.

It is a **snapshot** of the name at the time the record was created. If a product is renamed later, historical records still show the original name. This is critical for audit trails.

The same applies to lot_number in transaction_items.

---

## Files and Object Storage

The lot_files table stores only metadata. The actual binary is stored in cloud object storage (S3, GCS, etc.).

Workflow:
1. User uploads a file in the UI.
2. The server saves the binary to object storage using a new UUID as the key.
3. The server inserts a row into lot_files with that UUID, the filename, and MIME type.
4. To view the file, the server fetches it from object storage using lot_files.id.
5. When a lot is deleted, the application must delete the lot_files row AND the object from storage (the DB cascade only removes the row - the binary must be cleaned up in code).

This mirrors the existing IndexedDB approach exactly - the UUID was already the object key in the browser.
