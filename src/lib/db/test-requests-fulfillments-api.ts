/**
 * Integration test for the Requests + Fulfillments workflow.
 * Run with: npx tsx src/lib/db/test-requests-fulfillments-api.ts
 * Requires the Next.js dev server to be running on port 9002.
 */

const BASE = "http://localhost:9002";

function pass(msg: string) { console.log(`  PASS  ${msg}`); }
function fail(msg: string) { console.error(`  FAIL  ${msg}`); process.exitCode = 1; }
function note(msg: string) { console.log(`  NOTE  ${msg}`); }

async function run() {
  console.log("\n=== Requests + Fulfillments Workflow Integration Tests ===\n");

  // -------------------------------------------------------------------------
  // STEP 1: Create a test product with 1 lot (qty 20)
  // -------------------------------------------------------------------------
  console.log("1. POST /api/products  (create test product with 1 lot, qty 20)");

  const productRes = await fetch(`${BASE}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Req-Fulfillment Test Reagent",
      vendor: "Test Vendor",
      vendorPartNumber: "TV-RF-001",
      reorderThreshold: 5,
      lots: [{
        id: "bbbbbbbb-0000-0000-0000-000000000001",
        lotNumber: "LOT-RF-1",
        quantity: 20,
        receiptDate: "2025-01-01",
        expirationDate: "2027-01-01",
        location: "Room 2, Shelf A",
        file: null,
      }],
    }),
  });

  if (productRes.status !== 201) {
    fail(`Expected 201, got ${productRes.status}: ${await productRes.text()}`);
    return;
  }

  const product = await productRes.json();
  const productId: string = product.id;
  const lotId: string = product.lots[0].id;

  console.log(`  Product id : ${productId}`);
  console.log(`  Lot id     : ${lotId}  (qty 20)`);
  pass("Product created");

  // -------------------------------------------------------------------------
  // STEP 2: POST a product request
  // -------------------------------------------------------------------------
  console.log("\n2. POST /api/requests  (create product request)");

  const req1Res = await fetch(`${BASE}/api/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      productName: product.name,
      requestorName: "Dr. Jane Smith",
      requestorEmail: "jane.smith@nih.gov",
      department: "HULLC",
      quantity: 5,
      project: "Project Alpha",
      justification: "Needed for clinical trial phase 1.",
      sopRead: true,
    }),
  });

  if (req1Res.status !== 201) {
    fail(`Expected 201, got ${req1Res.status}: ${await req1Res.text()}`);
    await fetch(`${BASE}/api/products/${productId}`, { method: "DELETE" });
    return;
  }

  const req1 = await req1Res.json();
  const req1Id: string = req1.id;

  console.log(`  Request id : ${req1Id}`);
  console.log(`  Status     : ${req1.status}`);

  if (req1.status === "Pending") {
    pass("POST request returned status Pending");
  } else {
    fail(`POST request status expected Pending, got ${req1.status}`);
  }

  // -------------------------------------------------------------------------
  // STEP 3: GET all requests -- verify the new request appears
  // -------------------------------------------------------------------------
  console.log("\n3. GET /api/requests  (verify new request appears with status Pending)");

  const listRes = await fetch(`${BASE}/api/requests`);
  if (listRes.status !== 200) {
    fail(`Expected 200, got ${listRes.status}`);
  } else {
    const allReqs = await listRes.json();
    const found = allReqs.find((r: { id: string; status: string }) => r.id === req1Id);
    if (found && found.status === "Pending") {
      pass(`GET returned ${allReqs.length} request(s), new request present with status Pending`);
    } else if (!found) {
      fail("New request NOT found in GET list");
    } else {
      fail(`New request found but status is ${found.status}, expected Pending`);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 4: POST a fulfillment -- verify request advances to In Progress
  // -------------------------------------------------------------------------
  console.log("\n4. POST /api/fulfillments  (create fulfillment -- expect request -> In Progress)");

  const f1Res = await fetch(`${BASE}/api/fulfillments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: req1Id }),
  });

  if (f1Res.status !== 201) {
    fail(`Expected 201, got ${f1Res.status}: ${await f1Res.text()}`);
    await fetch(`${BASE}/api/products/${productId}`, { method: "DELETE" });
    return;
  }

  const f1 = await f1Res.json();
  const f1Id: string = f1.id;

  console.log(`  Fulfillment id : ${f1Id}`);
  pass("POST fulfillment returned 201");

  const req1AfterFulfillment = await (await fetch(`${BASE}/api/requests/${req1Id}`)).json();
  if (req1AfterFulfillment.status === "In Progress") {
    pass("Request status advanced to In Progress");
  } else {
    fail(`Expected request status In Progress, got ${req1AfterFulfillment.status}`);
  }

  // -------------------------------------------------------------------------
  // STEP 5: POST a second fulfillment for the same request -- expect 409
  // -------------------------------------------------------------------------
  console.log("\n5. POST /api/fulfillments  (duplicate for same request -- expect 409)");

  const f1dupRes = await fetch(`${BASE}/api/fulfillments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: req1Id }),
  });

  if (f1dupRes.status === 409) {
    const body = await f1dupRes.json();
    pass(`Duplicate fulfillment returned 409 -- "${body.error}"`);
  } else {
    fail(`Expected 409, got ${f1dupRes.status}: ${await f1dupRes.text()}`);
  }

  // -------------------------------------------------------------------------
  // STEP 6: PUT fulfillment -- dispense 5 units, verify request Completed
  // -------------------------------------------------------------------------
  console.log("\n6. PUT /api/fulfillments/:id  (dispense 5 units -- expect request -> Completed)");

  const putRes = await fetch(`${BASE}/api/fulfillments/${f1Id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: new Date().toISOString(),
      notes: "Fulfillment dispense for clinical trial.",
      items: [{ lotId, quantityTaken: 5 }],
    }),
  });

  if (putRes.status !== 200) {
    fail(`Expected 200, got ${putRes.status}: ${await putRes.text()}`);
    return;
  }

  const f1Updated = await putRes.json();
  const dispensedItems: Array<{ id: string; totalQuantity: number }> = f1Updated.dispensedItems ?? [];
  const txId: string = dispensedItems[0]?.id;

  console.log(`  Transaction id  : ${txId}`);
  console.log(`  Dispensed count : ${dispensedItems.length}`);

  if (dispensedItems.length === 1 && dispensedItems[0].totalQuantity === 5) {
    pass("PUT returned fulfillment with 1 dispensed item of quantity 5");
  } else {
    fail(`Expected 1 dispensed item qty 5, got ${JSON.stringify(dispensedItems.map(d => d.totalQuantity))}`);
  }

  const req1Completed = await (await fetch(`${BASE}/api/requests/${req1Id}`)).json();
  if (req1Completed.status === "Completed") {
    pass("Request status advanced to Completed");
  } else {
    fail(`Expected request status Completed, got ${req1Completed.status}`);
  }

  // -------------------------------------------------------------------------
  // STEP 7: GET product -- verify lot quantity decremented to 15
  // -------------------------------------------------------------------------
  console.log("\n7. GET /api/products/:id  (verify lot quantity decremented to 15)");

  const productAfterRes = await fetch(`${BASE}/api/products/${productId}`);
  if (productAfterRes.status !== 200) {
    fail(`Expected 200, got ${productAfterRes.status}`);
  } else {
    const productAfter = await productAfterRes.json();
    const lot = productAfter.lots.find((l: { id: string }) => l.id === lotId);
    if (lot?.quantity === 15) {
      pass("Lot quantity is 15 (20 - 5)");
    } else {
      fail(`Lot quantity expected 15, got ${lot?.quantity}`);
    }
  }

  // -------------------------------------------------------------------------
  // STEP 8: Invalid status transition Completed -> Pending -- expect 409
  // -------------------------------------------------------------------------
  console.log("\n8. PUT /api/requests/:id  (Completed -> Pending -- expect 409)");

  const badTransRes = await fetch(`${BASE}/api/requests/${req1Id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Pending" }),
  });

  if (badTransRes.status === 409) {
    const body = await badTransRes.json();
    pass(`Invalid transition returned 409 -- "${body.error}"`);
  } else {
    fail(`Expected 409, got ${badTransRes.status}: ${await badTransRes.text()}`);
  }

  // -------------------------------------------------------------------------
  // STEP 9: Second request -> fulfillment -> DELETE fulfillment -> Pending
  // -------------------------------------------------------------------------
  console.log("\n9. POST request -> POST fulfillment -> DELETE fulfillment  (verify reset to Pending)");

  const req2Res = await fetch(`${BASE}/api/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId,
      productName: product.name,
      requestorName: "Dr. Bob Lee",
      requestorEmail: "bob.lee@nih.gov",
      department: "Oncology",
      quantity: 3,
      project: "Project Beta",
      justification: "Required for study protocol B.",
      sopRead: true,
    }),
  });

  if (req2Res.status !== 201) {
    fail(`Expected 201 for req2, got ${req2Res.status}: ${await req2Res.text()}`);
    return;
  }
  const req2 = await req2Res.json();
  const req2Id: string = req2.id;
  console.log(`  Request 2 id    : ${req2Id}`);

  const f2Res = await fetch(`${BASE}/api/fulfillments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: req2Id }),
  });

  if (f2Res.status !== 201) {
    fail(`Expected 201 for f2, got ${f2Res.status}: ${await f2Res.text()}`);
    return;
  }
  const f2 = await f2Res.json();
  const f2Id: string = f2.id;
  console.log(`  Fulfillment 2 id: ${f2Id}`);

  const req2InProgress = await (await fetch(`${BASE}/api/requests/${req2Id}`)).json();
  if (req2InProgress.status === "In Progress") {
    pass("Request 2 is In Progress after fulfillment created");
  } else {
    fail(`Request 2 expected In Progress, got ${req2InProgress.status}`);
  }

  const delF2Res = await fetch(`${BASE}/api/fulfillments/${f2Id}`, { method: "DELETE" });
  if (delF2Res.status === 204) {
    pass("Fulfillment 2 cancelled (204)");
  } else {
    fail(`Expected 204 cancelling f2, got ${delF2Res.status}: ${await delF2Res.text()}`);
  }

  const req2Reset = await (await fetch(`${BASE}/api/requests/${req2Id}`)).json();
  if (req2Reset.status === "Pending") {
    pass("Request 2 reset to Pending after fulfillment cancelled");
  } else {
    fail(`Request 2 expected Pending after cancel, got ${req2Reset.status}`);
  }

  // -------------------------------------------------------------------------
  // STEP 10: DELETE fulfillment 1 (has a transaction) -- expect 409
  // -------------------------------------------------------------------------
  console.log("\n10. DELETE /api/fulfillments/:id  (has transaction -- expect 409)");

  const delF1EarlyRes = await fetch(`${BASE}/api/fulfillments/${f1Id}`, { method: "DELETE" });
  if (delF1EarlyRes.status === 409) {
    const body = await delF1EarlyRes.json();
    pass(`DELETE fulfillment with transaction returned 409 -- "${body.error}"`);
  } else {
    fail(`Expected 409, got ${delF1EarlyRes.status}: ${await delF1EarlyRes.text()}`);
  }

  // -------------------------------------------------------------------------
  // STEP 11: Cleanup
  //   Reverse the dispense transaction (restores lot qty), then delete f1.
  //   Product deletion is blocked by product_requests FK (ON DELETE RESTRICT) --
  //   a DELETE /api/requests endpoint is needed for full cleanup.
  // -------------------------------------------------------------------------
  console.log("\n11. Cleanup");

  const delTxRes = await fetch(`${BASE}/api/transactions/${txId}`, { method: "DELETE" });
  if (delTxRes.status === 204) {
    pass("Transaction reversed (204) -- lot qty restored to 20");
  } else {
    fail(`Expected 204 reversing transaction, got ${delTxRes.status}: ${await delTxRes.text()}`);
  }

  const delF1CleanRes = await fetch(`${BASE}/api/fulfillments/${f1Id}`, { method: "DELETE" });
  if (delF1CleanRes.status === 204) {
    pass("Fulfillment 1 deleted (204)");
  } else {
    fail(`Expected 204 deleting f1, got ${delF1CleanRes.status}: ${await delF1CleanRes.text()}`);
  }

  const delProductRes = await fetch(`${BASE}/api/products/${productId}`, { method: "DELETE" });
  if (delProductRes.status === 204) {
    pass("Test product deleted (204)");
  } else if (delProductRes.status === 409) {
    note(
      `Product delete returned 409 -- 2 requests still reference it (ON DELETE RESTRICT). ` +
      `A DELETE /api/requests endpoint is needed for full cleanup.`
    );
  } else {
    fail(`Unexpected status deleting product: ${delProductRes.status}: ${await delProductRes.text()}`);
  }

  console.log("\n=== Done ===\n");
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
