/**
 * Integration test for the Products REST API.
 * Run with: npx tsx src/lib/db/test-products-api.ts
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
  console.log("\n=== Products API Integration Tests ===\n");

  // POST /api/products — create a product with 2 lots
  console.log("1. POST /api/products");

  const createBody = {
    name: "Test Reagent Alpha",
    vendor: "Sigma-Aldrich",
    vendorPartNumber: "SIG-001",
    reorderThreshold: 10,
    lots: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        lotNumber: "LOT-A",
        quantity: 50,
        receiptDate: "2025-01-01",
        expirationDate: "2026-01-01",
        location: "Room 101, Shelf A",
        notes: "First lot",
        file: null,
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        lotNumber: "LOT-B",
        quantity: 30,
        receiptDate: "2025-02-01",
        expirationDate: null,
        location: "Room 101, Shelf B",
        file: null,
      },
    ],
  };

  const postRes = await fetch(`${BASE}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });

  if (postRes.status !== 201) {
    const text = await postRes.text();
    fail(`Expected 201, got ${postRes.status}: ${text}`);
    return;
  }

  const created = await postRes.json();
  const productId: string = created.id;
  console.log(`  Created product id: ${productId}`);
  console.log(`  Name: ${created.name}`);
  console.log(`  Lots count: ${created.lots?.length}`);

  if (created.name === "Test Reagent Alpha") {
    pass("POST returned correct name");
  } else {
    fail(`POST name mismatch: ${created.name}`);
  }

  if (Array.isArray(created.lots) && created.lots.length === 2) {
    pass("POST returned 2 lots");
  } else {
    fail(`POST lots count wrong: ${created.lots?.length}`);
  }

  // GET /api/products — list all
  console.log("\n2. GET /api/products");

  const listRes = await fetch(`${BASE}/api/products`);
  if (listRes.status !== 200) {
    fail(`Expected 200, got ${listRes.status}`);
    return;
  }

  const allProducts = await listRes.json();
  console.log(`  Total products: ${allProducts.length}`);
  pass(`GET returned ${allProducts.length} product(s)`);

  const found = allProducts.find((p: { id: string }) => p.id === productId);
  if (found) {
    pass("Created product appears in list");
  } else {
    fail("Created product NOT found in list");
  }

  // GET /api/products/:id
  console.log("\n3. GET /api/products/" + productId);

  const getRes = await fetch(`${BASE}/api/products/${productId}`);
  if (getRes.status !== 200) {
    fail(`Expected 200, got ${getRes.status}`);
    return;
  }

  const single = await getRes.json();
  if (single.id === productId) {
    pass("GET single returned correct id");
  } else {
    fail(`GET single id mismatch: ${single.id}`);
  }

  if (single.lots?.length === 2) {
    pass("GET single has 2 lots");
  } else {
    fail(`GET single lot count: ${single.lots?.length}`);
  }

  // PUT /api/products/:id — rename and add a 3rd lot
  console.log("\n4. PUT /api/products/" + productId);

  const lot1Id: string = single.lots[0].id;
  const lot2Id: string = single.lots[1].id;

  const updateBody = {
    name: "Test Reagent Alpha (Updated)",
    vendor: "Sigma-Aldrich",
    vendorPartNumber: "SIG-001-REV",
    reorderThreshold: 20,
    lots: [
      {
        id: lot1Id,
        lotNumber: "LOT-A",
        quantity: 45,
        receiptDate: "2025-01-01",
        expirationDate: "2026-01-01",
        location: "Room 101, Shelf A",
        notes: "Updated quantity",
        file: null,
      },
      {
        id: lot2Id,
        lotNumber: "LOT-B",
        quantity: 30,
        receiptDate: "2025-02-01",
        expirationDate: null,
        location: "Room 101, Shelf B",
        file: null,
      },
      {
        id: "00000000-0000-0000-0000-000000000003",
        lotNumber: "LOT-C",
        quantity: 100,
        receiptDate: "2025-03-01",
        expirationDate: "2027-01-01",
        location: "Room 102, Shelf A",
        notes: "Third lot added in update",
        file: null,
      },
    ],
  };

  const putRes = await fetch(`${BASE}/api/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateBody),
  });

  if (putRes.status !== 200) {
    const text = await putRes.text();
    fail(`Expected 200, got ${putRes.status}: ${text}`);
    return;
  }

  const updated = await putRes.json();
  if (updated.name === "Test Reagent Alpha (Updated)") {
    pass("PUT updated name correctly");
  } else {
    fail(`PUT name mismatch: ${updated.name}`);
  }

  if (updated.vendorPartNumber === "SIG-001-REV") {
    pass("PUT updated vendorPartNumber correctly");
  } else {
    fail(`PUT vendorPartNumber mismatch: ${updated.vendorPartNumber}`);
  }

  if (updated.lots?.length === 3) {
    pass("PUT now has 3 lots");
  } else {
    fail(`PUT lot count: ${updated.lots?.length}`);
  }

  // DELETE /api/products/:id
  console.log("\n5. DELETE /api/products/" + productId);

  const delRes = await fetch(`${BASE}/api/products/${productId}`, {
    method: "DELETE",
  });

  if (delRes.status !== 204) {
    const text = await delRes.text();
    fail(`Expected 204, got ${delRes.status}: ${text}`);
    return;
  }

  pass("DELETE returned 204");

  const confirmRes = await fetch(`${BASE}/api/products/${productId}`);
  if (confirmRes.status === 404) {
    pass("Deleted product returns 404");
  } else {
    fail(`Expected 404 after delete, got ${confirmRes.status}`);
  }

  console.log("\n=== Done ===\n");
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
