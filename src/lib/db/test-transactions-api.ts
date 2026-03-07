/**
 * Integration test for the Transactions REST API.
 * Run with: npx tsx src/lib/db/test-transactions-api.ts
 * Requires the Next.js dev server to be running on port 9002.
 */

const BASE = "http://localhost:9002";

function pass(msg: string) {
  console.log(`  PASS  ${msg}`);
}

function fail(msg: string) {
  console.error(`  FAIL  ${msg}`);
  process.exitCode = 1;
}

async function run() {
  console.log("\n=== Transactions API Integration Tests ===\n");

  // -------------------------------------------------------------------------
  // STEP 1: Create a test product with 2 lots (qty 10 and qty 5)
  // -------------------------------------------------------------------------
  console.log("1. POST /api/products  (create test product with 2 lots)");

  const productBody = {
    name: "Tx Test Reagent",
    vendor: "Test Vendor",
    vendorPartNumber: "TV-TX-001",
    reorderThreshold: 2,
    lots: [
      {
        id: "aaaaaaaa-0000-0000-0000-000000000001",
        lotNumber: "LOT-TX-1",
        quantity: 10,
        receiptDate: "2025-01-01",
        expirationDate: "2027-01-01",
        location: "Room 1, Shelf A",
        file: null,
      },
      {
        id: "aaaaaaaa-0000-0000-0000-000000000002",
        lotNumber: "LOT-TX-2",
        quantity: 5,
        receiptDate: "2025-02-01",
        expirationDate: null,
        location: "Room 1, Shelf B",
        file: null,
      },
    ],
  };

  const productRes = await fetch(`${BASE}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(productBody),
  });

  if (productRes.status !== 201) {
    const text = await productRes.text();
    fail(`Expected 201, got ${productRes.status}: ${text}`);
    return;
  }

  const product = await productRes.json();
  const productId: string = product.id;
  const lot1Id: string = product.lots.find(
    (l: { lotNumber: string }) => l.lotNumber === "LOT-TX-1"
  ).id;
  const lot2Id: string = product.lots.find(
    (l: { lotNumber: string }) => l.lotNumber === "LOT-TX-2"
  ).id;

  console.log(`  Product id : ${productId}`);
  console.log(`  Lot 1 id   : ${lot1Id}  (qty 10)`);
  console.log(`  Lot 2 id   : ${lot2Id}  (qty 5)`);
  pass("Product created with 2 lots");

  // -------------------------------------------------------------------------
  // STEP 2: POST a valid transaction — dispense 3 from lot1, 2 from lot2
  // -------------------------------------------------------------------------
  console.log("\n2. POST /api/transactions  (dispense 3 from lot1, 2 from lot2)");

  const txBody = {
    productId,
    date: new Date().toISOString(),
    notes: "Integration test dispense",
    items: [
      { lotId: lot1Id, quantityTaken: 3 },
      { lotId: lot2Id, quantityTaken: 2 },
    ],
    requestorName: "Test User",
    department: "HULLC",
  };

  const txRes = await fetch(`${BASE}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(txBody),
  });

  if (txRes.status !== 201) {
    const text = await txRes.text();
    fail(`Expected 201, got ${txRes.status}: ${text}`);
    await fetch(`${BASE}/api/products/${productId}`, { method: "DELETE" });
    return;
  }

  const tx = await txRes.json();
  const txId: string = tx.id;

  console.log(`  Transaction id  : ${txId}`);
  console.log(`  Total quantity  : ${tx.totalQuantity}`);
  console.log(`  Items count     : ${tx.items?.length}`);

  if (tx.totalQuantity === 5) {
    pass("POST totalQuantity is 5 (3 + 2)");
  } else {
    fail(`POST totalQuantity expected 5, got ${tx.totalQuantity}`);
  }

  if (Array.isArray(tx.items) && tx.items.length === 2) {
    pass("POST returned 2 transaction items");
  } else {
    fail(`POST items length expected 2, got ${tx.items?.length}`);
  }

  if (tx.productId === productId) {
    pass("POST transaction linked to correct product");
  } else {
    fail(`POST productId mismatch: ${tx.productId}`);
  }

  // -------------------------------------------------------------------------
  // STEP 3: GET all transactions — verify the new one appears
  // -------------------------------------------------------------------------
  console.log("\n3. GET /api/transactions?productId=<id>  (verify new transaction appears)");

  const listRes = await fetch(`${BASE}/api/transactions?productId=${productId}`);

  if (listRes.status !== 200) {
    fail(`Expected 200, got ${listRes.status}`);
  } else {
    const allTx = await listRes.json();
    const found = allTx.find((t: { id: string }) => t.id === txId);
    if (found) {
      pass(`GET returned ${allTx.length} transaction(s), new transaction present`);
    } else {
      fail("New transaction NOT found in GET list");
    }
  }

  // -------------------------------------------------------------------------
  // STEP 4: GET product — verify lot quantities decremented (7 and 3)
  // -------------------------------------------------------------------------
  console.log("\n4. GET /api/products/:id  (verify lots decremented to 7 and 3)");

  const p1Res = await fetch(`${BASE}/api/products/${productId}`);
  if (p1Res.status !== 200) {
    fail(`Expected 200, got ${p1Res.status}`);
  } else {
    const p1 = await p1Res.json();
    const l1 = p1.lots.find((l: { id: string }) => l.id === lot1Id);
    const l2 = p1.lots.find((l: { id: string }) => l.id === lot2Id);

    if (l1?.quantity === 7) {
      pass("Lot 1 quantity is 7 (10 - 3)");
    } else {
      fail(`Lot 1 quantity expected 7, got ${l1?.quantity}`);
    }

    if (l2?.quantity === 3) {
      pass("Lot 2 quantity is 3 (5 - 2)");
    } else {
      fail(`Lot 2 quantity expected 3, got ${l2?.quantity}`);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 5: POST transaction exceeding available stock — expect 409
  // -------------------------------------------------------------------------
  console.log("\n5. POST /api/transactions  (over-stock: request 100 from lot1 — expect 409)");

  const overStockBody = {
    productId,
    date: new Date().toISOString(),
    notes: "Should fail — over stock",
    items: [{ lotId: lot1Id, quantityTaken: 100 }],
  };

  const overRes = await fetch(`${BASE}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(overStockBody),
  });

  if (overRes.status === 409) {
    const body = await overRes.json();
    pass(`POST with over-stock returned 409 — "${body.error}"`);
  } else {
    const text = await overRes.text();
    fail(`Expected 409, got ${overRes.status}: ${text}`);
  }

  // -------------------------------------------------------------------------
  // STEP 6: DELETE the transaction — expect 204
  // -------------------------------------------------------------------------
  console.log(`\n6. DELETE /api/transactions/${txId}  (reverse transaction)`);

  const delRes = await fetch(`${BASE}/api/transactions/${txId}`, { method: "DELETE" });

  if (delRes.status === 204) {
    pass("DELETE returned 204");
  } else {
    const text = await delRes.text();
    fail(`Expected 204, got ${delRes.status}: ${text}`);
  }

  // -------------------------------------------------------------------------
  // STEP 7: GET product again — verify lot quantities restored (10 and 5)
  // -------------------------------------------------------------------------
  console.log("\n7. GET /api/products/:id  (verify lots restored to 10 and 5)");

  const p2Res = await fetch(`${BASE}/api/products/${productId}`);
  if (p2Res.status !== 200) {
    fail(`Expected 200, got ${p2Res.status}`);
  } else {
    const p2 = await p2Res.json();
    const l1r = p2.lots.find((l: { id: string }) => l.id === lot1Id);
    const l2r = p2.lots.find((l: { id: string }) => l.id === lot2Id);

    if (l1r?.quantity === 10) {
      pass("Lot 1 quantity restored to 10");
    } else {
      fail(`Lot 1 quantity expected 10, got ${l1r?.quantity}`);
    }

    if (l2r?.quantity === 5) {
      pass("Lot 2 quantity restored to 5");
    } else {
      fail(`Lot 2 quantity expected 5, got ${l2r?.quantity}`);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 8: DELETE the test product — cleanup
  // -------------------------------------------------------------------------
  console.log(`\n8. DELETE /api/products/${productId}  (cleanup)`);

  const cleanupRes = await fetch(`${BASE}/api/products/${productId}`, { method: "DELETE" });

  if (cleanupRes.status === 204) {
    pass("Test product deleted (204)");
  } else {
    const text = await cleanupRes.text();
    fail(`Expected 204 on cleanup, got ${cleanupRes.status}: ${text}`);
  }

  console.log("\n=== Done ===\n");
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
