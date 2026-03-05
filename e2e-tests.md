
# HULLC Inventory Management System E2E Test Plan

This document outlines the manual end-to-end test cases for the HULLC Inventory Management System application.

---

## 1. Authentication & Role Selection

| Test Case ID | Test Description                                                                               | Expected Result                                                                                           |
| :----------- | :--------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **AUTH-001** | On the login screen, select the "Admin" button.                                                | The user is taken to a screen asking to choose between "Core Inventory System" and a departmental system. |
| **AUTH-002** | As an Admin, select "Core Inventory System".                                                     | The user is logged into the Core Inventory dashboard with full admin privileges.                          |
| **AUTH-003** | As an Admin, select a department (e.g., "Neurology").                                          | The user is logged into the departmental view for "Neurology" with admin privileges (adjustment ability). |
| **AUTH-004** | On the login screen, select "Staff (Request Only)".                                              | The user is logged directly into the Core Inventory system with a simplified, request-only view.          |
| **AUTH-005** | On the login screen, select "Departmental Staff".                                                | The user is taken to a screen to select their department.                                                 |
| **AUTH-006** | As Departmental Staff, select a department (e.g., "Cardiology").                                 | The user is logged into the departmental view for "Cardiology" with standard staff privileges.            |
| **AUTH-007** | From any logged-in view, click the "Logout" button.                                              | The user's session is cleared, and they are returned to the initial role selection login screen.          |

---

## 2. Core System: Admin Functionality

### 2.1 Inventory Management

| Test Case ID | Test Description                                                                                                   | Expected Result                                                                                                                              |
| :----------- | :----------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **CORE-INV-001** | (Admin) Navigate to the "Inventory" tab and add a new product with a single lot. Fill all fields correctly.     | The new product appears in the inventory list. A success toast is shown.                                                                   |
| **CORE-INV-002** | (Admin) Edit an existing product's name and vendor part number.                                                  | The product's details are updated in the table.                                                                                              |
| **CORE-INV-003** | (Admin) Edit a product and add a new lot to it.                                                                  | The product's total quantity updates. The new lot is visible when the product row is expanded.                                             |
| **CORE-INV-004** | (Admin) Edit a product and delete one of its lots.                                                               | The product's total quantity updates. The deleted lot is no longer visible.                                                                |
| **CORE-INV-005** | (Admin) Click the "Delete" action on a product and confirm the deletion.                                         | The product is removed from the inventory table. A success toast is shown.                                                                 |
| **CORE-INV-006** | (Admin) Use the search bar to search for a product by its name.                                                  | The inventory list filters to show only products matching the search query.                                                                |
| **CORE-INV-007** | (Admin) Use the search bar to search for a product by its vendor part number.                                    | The list filters to show only the matching product.                                                                                        |
| **CORE-INV-008** | (Admin) Expand a product row to view its lots.                                                                   | A nested table appears showing all lots for that product, including lot #, quantity, dates, and location.                                  |
| **CORE-INV-009** | (Admin) Set a lot's quantity to 0.                                                                               | The product row should turn red to indicate it is out of stock.                                                                            |
| **CORE-INV-010** | (Admin) Set a lot's expiration date to a past date.                                                              | The product row should turn orange to indicate it has an expired lot.                                                                      |
| **CORE-INV-011** | (Admin) Set a product's quantity to be at or below its reorder threshold.                                        | A warning triangle icon appears next to the quantity.                                                                                      |
| **CORE-INV-012** | (Admin) In the "Add/Edit Product" form, upload a file (PDF/JPG) to a lot.                                        | The file name appears in the form. After saving, the file is available for download in the expanded lot details.                           |
| **CORE-INV-013** | (Admin) In the "Add/Edit Product" form, remove an uploaded file from a lot.                                      | The file is removed from the lot.                                                                                                          |

### 2.2 Product Requests & Fulfillment

| Test Case ID | Test Description                                                                                                   | Expected Result                                                                                                                              |
| :----------- | :----------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **CORE-REQ-001** | (Staff) In the core system, find a product and click "Request Item". Fill out and submit the form.                 | The request is submitted, and a success toast appears.                                                                                       |
| **CORE-REQ-002** | (Admin) Navigate to the "Product Requests" tab.                                                                  | The new request from the Staff user appears in the list with a "Pending" status.                                                           |
| **CORE-REQ-003** | (Admin) On a pending request, click "Fulfill". In the transaction form, dispense the requested quantity and save. | The transaction is created. The request's status changes to "Completed". The dispensed quantity is deducted from the core inventory.       |
| **CORE-REQ-004** | (Admin) After fulfilling a request for a department, log in as that department's staff.                            | The departmental inventory now shows the fulfilled product with the correct quantity.                                                      |
| **CORE-REQ-005** | (Admin) On a pending request, click "Reject" and confirm.                                                        | The request's status changes to "Rejected".                                                                                                |

### 2.3 Transactions & Data Portability

| Test case ID     | Test Description                                                                      | Expected Result                                                                                                               |
| :--------------- | :------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| **CORE-TRX-001** | (Admin) Create a manual transaction for a product.                                      | The transaction appears in the "Transactions" tab. The product's stock quantity is correctly reduced.                       |
| **CORE-TRX-002** | (Admin) Delete a transaction.                                                           | The transaction is removed from the history. The dispensed quantity is returned to the correct product lots in the inventory. |
| **CORE-CSV-001** | (Admin) Export the inventory to CSV.                                                    | A CSV file named `inventory_export.csv` is downloaded, containing all product and lot data.                                 |
| **CORE-CSV-002** | (Admin) Export the transactions to CSV.                                                 | A CSV file named `transactions_export.csv` is downloaded, containing all transaction data.                                  |
| **CORE-CSV-003** | (Admin) Import a valid CSV file of products.                                            | The products in the CSV are added to or updated in the inventory. A success toast is shown.                                   |
| **CORE-CSV-004** | (Admin) Import an invalid CSV file (e.g., missing required headers).                    | The import fails, and an error toast is shown with a descriptive message.                                                     |

---

## 3. Departmental Sub-System

| Test Case ID | Test Description                                                                                                   | Expected Result                                                                                                                              |
| :----------- | :----------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **DEPT-INV-001** | (Dept Staff) Log into a department that has no inventory.                                                          | The "Available Stock" table shows a message "No inventory has been allocated...". The "Consumption History" table is empty.              |
| **DEPT-INV-002** | (Dept Staff) Log into a department that has received stock from the core system.                                   | The "Available Stock" table correctly lists the products and their total quantities.                                                       |
| **DEPT-CON-001** | (Dept Staff) Click "Record Consumption" on a product. Enter a valid quantity and user name, then save.               | The product's quantity is reduced. A new "Consumption" entry appears in the "Consumption History" tab.                                   |
| **DEPT-CON-002** | (Dept Staff) Attempt to consume a quantity greater than the available stock.                                       | An error toast "Insufficient Stock" appears, and the consumption is not recorded.                                                          |
| **DEPT-CON-003** | (Dept Staff) Use the search bar in the departmental view.                                                          | The product list filters based on the product name or ID.                                                                                  |
| **DEPT-ADM-001** | (Admin) Log into a departmental view. Verify the "Adjust Stock" button is visible.                                 | The "Adjust Stock" button is present for each product.                                                                                     |
| **DEPT-ADM-002** | (Dept Staff) Log into a departmental view. Verify the "Adjust Stock" button is NOT visible.                        | The "Adjust Stock" button is not present.                                                                                                  |
| **DEPT-ADM-003** | (Admin) Use "Adjust Stock" to add quantity to a product. Provide a reason.                                         | The product's quantity increases. A new "Adjustment" transaction appears in the history, with a positive quantity and the admin's note.    |
| **DEPT-ADM-004** | (Admin) Use "Adjust Stock" to remove quantity from a product. Provide a reason.                                    | The product's quantity decreases. A new "Adjustment" transaction appears in the history, with a negative quantity and the admin's note. |
| **DEPT-ADM-005** | (Admin) Attempt to adjust stock with an invalid quantity (e.g., resulting in negative stock).                      | An error toast appears, and the adjustment is not saved.                                                                                   |
